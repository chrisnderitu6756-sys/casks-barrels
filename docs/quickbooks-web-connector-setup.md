# QuickBooks Desktop 2024 → Casks & Barrels Dashboard
## Web Connector Integration Runbook (Phase 1)

**Goal:** a read-only, scheduled sync of **customers, products (items), and invoices** from the client's
QuickBooks Desktop 2024 company file into our dashboard, using the official **QuickBooks SDK (qbXML)**
over the **QuickBooks Web Connector (QBWC)**.

> Phase 1 is **read-only**. We never write to the client's books. Invoice data is labelled
> *invoiced sales*, never *deliveries*.

---

### How it works (the 30-second version)

```
QuickBooks Desktop 2024 ──┐
 (client PC)              │  qbXML (SDK)
                          ▼
            QuickBooks Web Connector (QBWC)        ── installed on the SAME client PC
                          │
                          │  HTTPS + SOAP  (outbound only)
                          ▼
            Our SOAP endpoint   https://<our-app>/api/qbwc
                          │
                          ▼
              Our database ──► the dashboard (with a "last updated" stamp)
```

The Web Connector lives on the client's machine beside QuickBooks. On a schedule it **calls out** to our
HTTPS endpoint, we hand it read-only qbXML queries, it runs them against the company file and returns the
data, and we store it. QuickBooks is never exposed to the internet — the client's PC only makes **outbound**
calls.

---

### Prerequisites

| On the client's PC | On our side |
|---|---|
| QuickBooks Desktop 2024 (Pro / Premier / Enterprise), region confirmed | A public **HTTPS** SOAP endpoint with a valid TLS cert (e.g. `https://app.../api/qbwc`) |
| The company file (`.QBW`) + **QuickBooks Admin** login | The 8 SOAP callbacks implemented (Part 1) |
| **QuickBooks Web Connector** installed (bundled with QBD, or free from Intuit) | A generated `.qwc` config file + an app password (Part 2) |
| The PC powered on when syncs run | A DB to store data + the `lastSuccessfulSync` timestamp |

---

### Part 1 — Developer: build the SOAP endpoint

QBWC speaks **SOAP 1.1** against a fixed WSDL. Implement these 8 operations at `/api/qbwc`:

| Method | You return | Purpose |
|---|---|---|
| `serverVersion()` | your app version string | banner |
| `clientVersion(v)` | `""` to accept (or `W:`/`E:` to warn/block old QBWC) | version gate |
| `authenticate(user, pass)` | `[ticket, companyFile]` | validate QBWC login, start a session |
| `sendRequestXML(ticket, …, country, major, minor)` | a **qbXML request** string | the next query to run |
| `receiveResponseXML(ticket, response, hresult, msg)` | int **0–100** (% done) | parse + store the result; `<100` ⇒ call me again |
| `getLastError(ticket)` | error text (or a "no work" message) | surfaced in the QBWC log |
| `connectionError(ticket, hresult, msg)` | `"done"` or a `.qbw` path | connection trouble handling |
| `closeConnection(ticket)` | status string | cleanup, shown in QBWC |

**`authenticate` details:** generate a GUID **ticket** (your session token) and return it with the
company-file to use:
- `""` = use the company file **currently open** in QuickBooks.
- a full path = open **that** file (required for "sync even when QuickBooks isn't running").
- Return `"none"` for "nothing to do", `"nvu"` for an invalid user.

**Read-only queries only** (honour the qbXML version QBWC reports in `sendRequestXML`):
- `CustomerQueryRq` — accounts (name, type, area/address, owner)
- `ItemQueryRq` / `ItemInventoryQueryRq` / `ItemServiceQueryRq` — products
- `InvoiceQueryRq` with `<IncludeLineItems>true</IncludeLineItems>` — invoiced sales + quantities

**Incremental sync:** use `FromModifiedDate` / `ModifiedDateRangeFilter` to pull only what changed since
`lastSuccessfulSync`. Update `lastSuccessfulSync` only when a run reaches 100% cleanly — that stamp is what
the dashboard's **freshness indicator** shows.

Example request (customers changed since last sync):

```xml
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq>
      <FromModifiedDate>2026-11-01T00:00:00</FromModifiedDate>
    </CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>
```

---

### Part 2 — Generate the `.qwc` config file

An XML file the admin imports into the Web Connector. `AppURL` and `AppSupport` **must be HTTPS**
(only `localhost` may be plain HTTP, for dev). Generate `OwnerID`/`FileID` once and keep them stable.

```xml
<?xml version="1.0"?>
<QBWCXML>
  <AppName>Casks &amp; Barrels Sync</AppName>
  <AppID></AppID>
  <AppURL>https://YOUR-DOMAIN/api/qbwc</AppURL>
  <AppDescription>Read-only sync of customers, items and invoices to the Casks &amp; Barrels dashboard.</AppDescription>
  <AppSupport>https://YOUR-DOMAIN/support</AppSupport>
  <UserName>cnb-sync</UserName>
  <OwnerID>{57F3B9B0-86F1-4FCC-B1EE-566DE1813D20}</OwnerID>
  <FileID>{57F3B9B0-86F1-4FCC-B1EE-566DE1813D21}</FileID>
  <QBType>QBFS</QBType>
  <IsReadOnly>true</IsReadOnly>
  <Scheduler>
    <RunEveryNMinutes>60</RunEveryNMinutes>
  </Scheduler>
</QBWCXML>
```

Deliver the `.qwc` **and** the app password (`UserName` above) to the admin **separately and securely**.
The password is *not* a QuickBooks password — it's one you set for this integration.

---

### Part 3 — On the client's PC: install & authorize (one-time, needs QB Admin)

1. Install **QuickBooks Web Connector** on the PC that runs QuickBooks (skip if already present).
2. Open **QuickBooks Desktop** as **Admin** and open the company file. To allow *unattended* syncs,
   switch to **single-user mode** (File → Switch to Single-user Mode) for this step.
3. Launch **Web Connector → Add an Application** → select the `.qwc` file → accept the security prompt.
4. QuickBooks shows the **"Authorize New Web Service / Application Certificate"** dialog. The admin chooses:
   - **"Yes, always; allow access even if QuickBooks is not running"** → then pick the QB login the sync runs
     as. *(Use this for scheduled/unattended sync.)*
   - *or* "Yes, whenever this company file is open" (only syncs while someone has QB open).
   - Grant **read-only**; decline personal-data access if offered — we don't need it.
5. Confirm → QuickBooks records the integrated app (later visible under
   **Edit → Preferences → Integrated Applications → Company Preferences**).
6. Back in Web Connector, enter the app **password** on that row → save it when prompted.
7. Tick **Auto-Run** and set the interval if you want it scheduled (the `.qwc` already requests every 60 min).

---

### Part 4 — First sync & reconciliation

1. In Web Connector, tick the app → **Update Selected** (a manual run).
2. Watch the status/progress bar reach **"Last run: completed."**
3. Confirm the customer/item/invoice counts land in the dashboard and the **"Last updated"** stamp appears.
4. **Reconcile a sample** of customers + products against QuickBooks with the client's validator —
   this is acceptance check #1.

---

### Part 5 — Scheduled, unattended operation + freshness

- **Auto-Run** fires on the interval. The PC must be **on**; for "even when not running", QBWC uses the
  stored login + company-file path.
- **Refresh failure handling:** if a run fails (PC off, file locked, QB updating), log it and **keep showing
  the last good update time** so stale data is obvious — acceptance check #4. QBWC's own log is at
  **View Log** (`QWCLog.txt`).

---

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| "HTTP/connection error" in QBWC | endpoint not reachable over **HTTPS**, invalid cert, or firewall blocking outbound |
| Auth fails (`nvu`) | app username/password mismatch between `.qwc` and your `authenticate` |
| "QuickBooks is not running" | you're in "only when open" mode — open QB, or re-authorize with "even when not running" |
| "Could not start QuickBooks / access the company file" | file moved/locked, or an op needs single-user mode |
| Need to reset access | Edit → Preferences → Integrated Applications → Company Preferences → remove, then re-add the app |

---

### Security notes

- HTTPS with a valid certificate is **mandatory** for a remote endpoint.
- The app password is stored by QBWC and is **separate** from the QuickBooks Admin password.
- Least privilege: the app is **read-only** and declines personal-data scopes.
- The client's PC only makes **outbound** calls — QuickBooks is never opened to inbound internet traffic.
- Phase 1 = **one** company file only.

---

### Still to confirm at the compatibility check (from the brief)

- [ ] QuickBooks Desktop **edition** (Pro / Premier / Enterprise) and **region**
- [ ] Which **PC/server** hosts the company file, and whether it can **stay on** for syncs
- [ ] Who the **QuickBooks Admin** is (does the one-time authorization)
- [ ] Where **customer type** and **area** live (Customer Type list / a custom field / the address)
- [ ] Desired **sync frequency** (daily vs. more often)
- [ ] **Hosting** for our endpoint (client pays — document the cost)
