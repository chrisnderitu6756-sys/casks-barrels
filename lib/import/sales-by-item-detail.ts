// ---------------------------------------------------------------------------
// QuickBooks "Sales by Item Detail" importer
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS
// The client runs QuickBooks Desktop 2014 (UK edition), so a live API is not
// viable. Instead a scheduled "Sales by Item Detail" report is exported to
// CSV/Excel and imported here. This file is the single place that knows how a
// QuickBooks export maps onto the dashboard's domain model (`Order`,
// `OrderLine`, `Account`). It is pure (no I/O, no React, no globals), so:
//   - the Setup page calls it with text read in the browser (FileReader), and
//   - a future live feed (e.g. a QuickBooks Web Connector / SDK service that
//     returns the same report rows) can call the very same function: serialise
//     the rows as CSV, or call `parseRows(rows)` directly with a 2-D string
//     array. Nothing downstream needs to change.
//
// THE EXPORT
// One row per LINE ITEM on an invoice / sales receipt. Roughly:
//
//   Type     | Date       | Num  | Name                  | Item             | Qty | Sales Price | Amount
//   Invoice  | 11/11/2026 | 1042 | Savannah Grill:Karen  | Excelsior Merlot | 24  | 950.00      | 22,800.00
//
// Column order and labels vary between export templates and the sheet usually
// has blank spacer columns, title lines above the header and "Total ..."
// subtotal rows. So we:
//   1. find the header row by matching known header names (case-insensitive),
//   2. map columns BY NAME, never by index,
//   3. skip rows that have no Item or no Num (grouping / subtotal rows).
//
// MAPPING
//   Type            -> Order.docType   ("Invoice" -> "invoice",
//                                       "Sales Receipt" -> "sales-receipt";
//                                       other types e.g. Credit Memo are skipped + warned)
//   Date (dd/mm/yyyy, UK) -> Order.date (ISO)
//   Num             -> Order.number
//   Name            -> Account. "Parent:Sub" splits into parent + sub (parentId)
//   Item            -> OrderLine.productId (fuzzy match to the product catalogue)
//   Qty             -> OrderLine.quantity
//   Amount          -> OrderLine.netAmount (net of VAT, as QuickBooks reports it)
//   Rows are grouped by (Name + Num + Date) into one Order.
//
// REAL-WORLD GOTCHA
// The first export the client sent had Amounts but NO Quantity column. Health
// analysis is quantity-based (uptake per product), so this is detected and
// reported as a prominent warning rather than silently importing zeros.
//
// All figures are "invoiced sales" - never treated as deliveries.
// ---------------------------------------------------------------------------

import type { Order, OrderLine, Product } from "@/lib/types";
import { products as catalogueProducts, accounts as catalogueAccounts } from "@/lib/data/sample-data";

// ---- Public types ----------------------------------------------------------

/** A customer derived from the export's Name column. */
export interface ParsedAccount {
  /** Slug of the full QuickBooks name, or the existing account's id when matched. */
  id: string;
  /** Display name (the sub-customer part when the name is "Parent:Sub"). */
  name: string;
  /** Full QuickBooks name, e.g. "Savannah Grill:Karen". */
  fullName: string;
  /** Parent account id when the name was "Parent:Sub". */
  parentId?: string;
  /** True when this customer already exists in the dashboard's account list. */
  matchedExisting: boolean;
  /** Number of orders parsed for this customer. */
  orderCount: number;
}

export interface ImportStats {
  /** Non-empty rows read from the file (including header/title/subtotal rows). */
  rowsRead: number;
  /** Rows that became order lines. */
  lineItems: number;
  /** Rows skipped (grouping/subtotal rows, unsupported types, bad rows). */
  rowsSkipped: number;
  orders: number;
  customers: number;
  /** Distinct item names seen. */
  distinctProducts: number;
  /** Distinct item names matched to the catalogue. */
  matchedProducts: number;
  /** Item names that could not be matched to the catalogue. */
  unmatchedProducts: string[];
  /** Customers not found in the dashboard's current account list. */
  unmatchedCustomers: string[];
  /** False when no usable quantity data was found (see warnings). */
  hasQuantity: boolean;
  /** Sum of line net amounts, KES. */
  totalNet: number;
  /** Earliest / latest order date (ISO), or null if nothing parsed. */
  dateRange: { from: string; to: string } | null;
  /** Which header each canonical field was mapped from, e.g. { qty: "Quantity" }. */
  detectedColumns: Partial<Record<ColumnKey, string>>;
}

export interface ImportResult {
  orders: Order[];
  accounts: ParsedAccount[];
  /** Distinct item names as they appeared in the export. */
  products: string[];
  warnings: string[];
  stats: ImportStats;
}

export interface ImportOptions {
  /** Catalogue to match items against. Defaults to the foundation products. */
  knownProducts?: Pick<Product, "id" | "name">[];
  /** Existing accounts to match customers against. Defaults to the foundation accounts. */
  knownAccounts?: { id: string; name: string }[];
}

export type ColumnKey = "type" | "date" | "num" | "name" | "item" | "qty" | "price" | "amount";

// ---- Small helpers ---------------------------------------------------------

/** "Savannah Grill & Bar" -> "savannah-grill-bar". Stable, URL-safe id. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Lower-case, strip everything but letters/digits - for fuzzy comparison. */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Split "Parent:Sub" (QuickBooks customer:job). Only the first colon splits;
 * deeper levels stay in the sub name.
 */
export function splitCustomerName(full: string): { parent?: string; sub: string } {
  const idx = full.indexOf(":");
  if (idx <= 0 || idx === full.length - 1) return { sub: full.trim() };
  return { parent: full.slice(0, idx).trim(), sub: full.slice(idx + 1).trim() };
}

/**
 * Parse a number as QuickBooks / Excel prints it: "1,234.50", "KES 950",
 * "(120.00)" or "120.00-" for negatives. Returns null for blank / non-numeric.
 */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/kes|ksh|ksh\.|£|\$|,|\s/gi, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Parse a report date to an ISO string (UTC midnight). QuickBooks UK prints
 * dd/mm/yyyy, so slashes are read day-first. Also accepts yyyy-mm-dd and
 * "11 Nov 2026". Returns null if unparseable.
 */
export function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/))) {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
  } else if ((match = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{2,4})/))) {
    d = Number(match[1]);
    m = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    y = Number(match[3]);
    if (y < 100) y += 2000;
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null; // e.g. 31/02
  return dt.toISOString();
}

// ---- CSV -------------------------------------------------------------------

/** Pick the delimiter (comma, tab or semicolon) that best splits the first lines. */
function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 15).join("\n");
  const counts = { ",": 0, "\t": 0, ";": 0 };
  let inQuotes = false;
  for (const ch of sample) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as keyof typeof counts]++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? best : ",";
}

/**
 * Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes (""), embedded
 * newlines, CRLF/LF, BOM. Delimiter is auto-detected (comma / tab / semicolon).
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---- Header detection ------------------------------------------------------

/** Known header labels per canonical field (compared after normalising). */
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  type: ["type", "transaction type", "txn type"],
  date: ["date", "txn date", "transaction date", "invoice date"],
  num: ["num", "no", "number", "invoice", "invoice num", "invoice no", "invoice number", "ref", "ref no", "doc no"],
  name: ["name", "customer", "customer job", "customer name", "source name", "client"],
  item: ["item", "product", "item name", "product service", "product name", "item description", "description"],
  qty: ["qty", "quantity", "qty sold", "units", "units sold"],
  price: ["sales price", "price", "unit price", "rate", "u m price", "avg price"],
  amount: ["amount", "net amount", "sales amount", "line amount", "total", "net"],
};

/** "Invoice #", "Customer:Job", "Qty." -> "invoice", "customer job", "qty". */
function normaliseHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[#.:/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ColumnMap = Partial<Record<ColumnKey, number>>;

/** Map header cells to canonical fields. First match wins; earlier aliases are preferred. */
function mapHeaders(cells: string[]): { map: ColumnMap; labels: Partial<Record<ColumnKey, string>> } {
  const map: ColumnMap = {};
  const labels: Partial<Record<ColumnKey, string>> = {};
  const norm = cells.map(normaliseHeader);
  (Object.keys(HEADER_ALIASES) as ColumnKey[]).forEach((key) => {
    for (const alias of HEADER_ALIASES[key]) {
      const idx = norm.findIndex((c, i) => c === alias && !Object.values(map).includes(i));
      if (idx >= 0) {
        map[key] = idx;
        labels[key] = cells[idx].trim();
        return;
      }
    }
  });
  return { map, labels };
}

/** A header row needs an Item column plus at least two more recognised columns. */
function looksLikeHeader(map: ColumnMap): boolean {
  const found = Object.keys(map).length;
  return map.item !== undefined && found >= 3 && (map.amount !== undefined || map.qty !== undefined);
}

// ---- Product matching ------------------------------------------------------

function buildProductMatcher(known: Pick<Product, "id" | "name">[]) {
  const prepared = known.map((p) => ({ ...p, sq: squash(p.name), tk: tokens(p.name) }));
  const cache = new Map<string, string | null>();

  return (itemName: string): string | null => {
    const key = itemName.toLowerCase();
    if (cache.has(key)) return cache.get(key)!;
    // QuickBooks items may be hierarchical: "Wine:Excelsior Merlot 750ml".
    const candidates = [itemName, itemName.split(":").pop() ?? itemName].map((c) => ({
      sq: squash(c),
      tk: tokens(c),
    }));
    let best: string | null = null;

    for (const c of candidates) {
      if (!c.sq) continue;
      // 1) exact (case/punctuation-insensitive)
      const exact = prepared.find((p) => p.sq === c.sq);
      if (exact) {
        best = exact.id;
        break;
      }
      // 2) contains, either direction (longest catalogue name wins)
      const contains = prepared
        .filter((p) => p.sq.length >= 4 && (c.sq.includes(p.sq) || (c.sq.length >= 4 && p.sq.includes(c.sq))))
        .sort((a, b) => b.sq.length - a.sq.length)[0];
      if (contains) {
        best = contains.id;
        break;
      }
      // 3) token overlap: >= 75% of the catalogue name's words appear in the item
      let bestScore = 0;
      for (const p of prepared) {
        if (!p.tk.length) continue;
        const hit = p.tk.filter((t) => c.tk.includes(t)).length / p.tk.length;
        if (hit >= 0.75 && hit > bestScore) {
          bestScore = hit;
          best = p.id;
        }
      }
      if (best) break;
    }
    cache.set(key, best);
    return best;
  };
}

// ---- Main ------------------------------------------------------------------

const MAX_LISTED = 6;
const listSome = (xs: string[]) =>
  xs.slice(0, MAX_LISTED).join(", ") + (xs.length > MAX_LISTED ? `, +${xs.length - MAX_LISTED} more` : "");

/** Parse a "Sales by Item Detail" CSV (or tab/semicolon-separated paste). */
export function parseSalesByItemDetail(csvText: string, options: ImportOptions = {}): ImportResult {
  return parseRows(parseCsv(csvText), options);
}

/**
 * Same as `parseSalesByItemDetail` but for already-split rows - the entry point
 * a future live connector can use without going through CSV.
 */
export function parseRows(allRows: string[][], options: ImportOptions = {}): ImportResult {
  const knownProducts = options.knownProducts ?? catalogueProducts;
  const knownAccounts = options.knownAccounts ?? catalogueAccounts;
  const warnings: string[] = [];

  const rows = allRows
    .map((r, i) => ({ cells: r, line: i + 1 }))
    .filter((r) => r.cells.some((c) => c.trim() !== ""));

  const emptyStats = (): ImportStats => ({
    rowsRead: rows.length,
    lineItems: 0,
    rowsSkipped: rows.length,
    orders: 0,
    customers: 0,
    distinctProducts: 0,
    matchedProducts: 0,
    unmatchedProducts: [],
    unmatchedCustomers: [],
    hasQuantity: false,
    totalNet: 0,
    dateRange: null,
    detectedColumns: {},
  });

  // 1) Find the header row (first 40 non-empty rows).
  let headerAt = -1;
  let colMap: ColumnMap = {};
  let labels: Partial<Record<ColumnKey, string>> = {};
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const m = mapHeaders(rows[i].cells);
    if (looksLikeHeader(m.map)) {
      headerAt = i;
      colMap = m.map;
      labels = m.labels;
      break;
    }
  }
  if (headerAt < 0) {
    warnings.push(
      rows.length === 0
        ? "The file is empty - nothing to import."
        : "Could not find a header row. Expected a \"Sales by Item Detail\" export with columns such as Type, Date, Num, Name, Item, Qty and Amount.",
    );
    return { orders: [], accounts: [], products: [], warnings, stats: emptyStats() };
  }

  // 2) Column-level warnings.
  const missing = (["date", "num", "name", "amount"] as ColumnKey[]).filter((k) => colMap[k] === undefined);
  const canDeriveQty = colMap.qty === undefined && colMap.price !== undefined;
  if (colMap.qty === undefined) {
    warnings.push(
      canDeriveQty
        ? "No Quantity column found in this export - quantities were ESTIMATED as Amount / Sales Price. Re-export \"Sales by Item Detail\" with the Qty column switched on (Customize Report > Display > Columns > Qty) for reliable buying-pattern analysis."
        : "No Quantity column found in this export. Amounts were imported but every quantity is 0, so buying-pattern health (uptake per product) cannot be assessed. Re-export \"Sales by Item Detail\" with the Qty column switched on (Customize Report > Display > Columns > Qty).",
    );
  }
  if (missing.length) {
    warnings.push(`Missing expected column(s): ${missing.join(", ")}. Rows without them are skipped.`);
  }

  const matchProduct = buildProductMatcher(knownProducts);
  const cell = (r: string[], k: ColumnKey) => (colMap[k] === undefined ? "" : (r[colMap[k]!] ?? "").trim());

  // 3) Walk the data rows.
  type Draft = { order: Order; key: string; fullName: string };
  const drafts = new Map<string, Draft>();
  const itemNames = new Set<string>();
  const matchedItems = new Set<string>();
  const unmatchedItems = new Set<string>();
  const customerFull = new Map<string, { orders: Set<string> }>();

  let groupItem = ""; // item carried from a "group header" row, when the report is grouped by item
  let skipped = headerAt + 1; // title lines and the header itself
  let blankCustomerRows = 0;
  let blankQtyRows = 0;
  let lineItems = 0;
  let totalNet = 0;
  const badRows: string[] = [];
  const skippedTypes = new Map<string, number>();

  for (let i = headerAt + 1; i < rows.length; i++) {
    const { cells, line } = rows[i];
    const nonEmpty = cells.filter((c) => c.trim() !== "");

    // Group header row: a lone label (e.g. an item heading) - remember it, skip it.
    if (nonEmpty.length === 1 && !/^total\b/i.test(nonEmpty[0].trim())) {
      groupItem = nonEmpty[0].trim().replace(/:$/, "");
      skipped++;
      continue;
    }

    const item = cell(cells, "item") || groupItem;
    const num = cell(cells, "num");
    if (!item || !num) {
      // Subtotal / grand-total / spacer rows. Only flag if it looks like a real line.
      if (item && !num && parseNumber(cell(cells, "amount")) !== null && !/^total\b/i.test(item)) {
        badRows.push(`row ${line} (no invoice number)`);
      }
      skipped++;
      continue;
    }

    // Document type.
    const rawType = cell(cells, "type");
    const typeKey = rawType.toLowerCase();
    let docType: Order["docType"] = "invoice";
    if (typeKey && typeKey !== "invoice") {
      if (/^sales?\s*receipt$/.test(typeKey)) docType = "sales-receipt";
      else {
        skippedTypes.set(rawType, (skippedTypes.get(rawType) ?? 0) + 1);
        skipped++;
        continue;
      }
    }

    const date = parseDate(cell(cells, "date"));
    const amount = parseNumber(cell(cells, "amount"));
    if (!date || amount === null) {
      badRows.push(`row ${line} (${!date ? "unreadable date" : "unreadable amount"})`);
      skipped++;
      continue;
    }

    const fullName = cell(cells, "name");
    if (!fullName) {
      blankCustomerRows++;
      skipped++;
      continue;
    }

    // Quantity.
    const qtyRaw = parseNumber(cell(cells, "qty"));
    let quantity = 0;
    if (colMap.qty !== undefined) {
      if (qtyRaw === null) blankQtyRows++;
      else quantity = qtyRaw;
    } else if (canDeriveQty) {
      const price = parseNumber(cell(cells, "price"));
      if (price && price > 0) quantity = Math.round((amount / price) * 100) / 100;
    }

    // Product.
    itemNames.add(item);
    const matched = matchProduct(item);
    let productId: string;
    if (matched) {
      productId = matched;
      matchedItems.add(item);
    } else {
      productId = `unmatched-${slugify(item) || "item"}`;
      unmatchedItems.add(item);
    }

    // Group into an order by Name + Num + Date.
    const key = `${fullName.toLowerCase()}|${num}|${date}`;
    let draft = drafts.get(key);
    if (!draft) {
      draft = {
        key,
        fullName,
        order: {
          id: `imp-${slugify(num)}-${slugify(fullName)}`,
          number: num,
          accountId: slugify(fullName), // resolved to an existing id below
          date,
          docType,
          lines: [],
        },
      };
      drafts.set(key, draft);
      const c = customerFull.get(fullName) ?? { orders: new Set<string>() };
      c.orders.add(key);
      customerFull.set(fullName, c);
    }
    const line_: OrderLine = { productId, quantity, netAmount: amount };
    draft.order.lines.push(line_);
    lineItems++;
    totalNet += amount;
  }

  // 4) Customers -> ParsedAccount (+ parents), matched to existing accounts where possible.
  const existingByName = new Map<string, string>();
  for (const a of knownAccounts) {
    existingByName.set(a.name.toLowerCase(), a.id);
    existingByName.set(slugify(a.name), a.id);
  }
  const resolveExisting = (full: string) =>
    existingByName.get(full.toLowerCase()) ?? existingByName.get(slugify(full));

  const accountMap = new Map<string, ParsedAccount>();
  const idForFull = new Map<string, string>();
  const unmatchedCustomers: string[] = [];

  for (const [full, info] of customerFull) {
    const existing = resolveExisting(full);
    const id = existing ?? slugify(full);
    idForFull.set(full, id);
    const { parent, sub } = splitCustomerName(full);
    let parentId: string | undefined;
    if (parent) {
      const parentExisting = resolveExisting(parent);
      parentId = parentExisting ?? slugify(parent);
      if (!accountMap.has(parentId)) {
        accountMap.set(parentId, {
          id: parentId,
          name: parent,
          fullName: parent,
          matchedExisting: Boolean(parentExisting),
          orderCount: 0,
        });
      }
    }
    const prev = accountMap.get(id);
    accountMap.set(id, {
      id,
      name: sub,
      fullName: full,
      ...(parentId ? { parentId } : {}),
      matchedExisting: Boolean(existing),
      orderCount: (prev?.orderCount ?? 0) + info.orders.size,
    });
    if (!existing) unmatchedCustomers.push(full);
  }

  const orders: Order[] = [];
  for (const d of drafts.values()) {
    d.order.accountId = idForFull.get(d.fullName) ?? d.order.accountId;
    orders.push(d.order);
  }
  orders.sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number, undefined, { numeric: true }));

  // 5) Remaining warnings.
  const allBlankQty = colMap.qty !== undefined && lineItems > 0 && blankQtyRows === lineItems;
  if (allBlankQty) {
    warnings.unshift(
      "The Quantity column is present but empty on every row. Quantities were imported as 0, so buying-pattern health cannot be assessed. Re-export with quantities populated.",
    );
  } else if (blankQtyRows > 0) {
    warnings.push(`${blankQtyRows} line(s) had a blank Quantity and were imported as 0.`);
  }
  if (unmatchedItems.size) {
    warnings.push(
      `${unmatchedItems.size} product name(s) did not match the catalogue and were imported with a generated product id: ${listSome([...unmatchedItems])}.`,
    );
  }
  if (blankCustomerRows) {
    warnings.push(`${blankCustomerRows} row(s) had no customer Name and were skipped.`);
  }
  if (unmatchedCustomers.length) {
    warnings.push(
      `${unmatchedCustomers.length} customer(s) are not in the current account list (they would be created as new accounts): ${listSome(unmatchedCustomers)}.`,
    );
  }
  for (const [t, n] of skippedTypes) {
    warnings.push(`${n} "${t}" row(s) skipped - only invoices and sales receipts are imported.`);
  }
  if (badRows.length) {
    warnings.push(`${badRows.length} unparseable row(s) skipped: ${listSome(badRows)}.`);
  }
  if (lineItems === 0 && !warnings.some((w) => w.startsWith("Could not"))) {
    warnings.push("A header row was found but no usable data rows followed it.");
  }

  const dates = orders.map((o) => o.date).sort();
  const stats: ImportStats = {
    rowsRead: rows.length,
    lineItems,
    rowsSkipped: skipped,
    orders: orders.length,
    customers: [...accountMap.values()].filter((a) => a.orderCount > 0).length,
    distinctProducts: itemNames.size,
    matchedProducts: matchedItems.size,
    unmatchedProducts: [...unmatchedItems],
    unmatchedCustomers,
    hasQuantity: colMap.qty !== undefined && !allBlankQty,
    totalNet,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    detectedColumns: labels,
  };

  return {
    orders,
    accounts: [...accountMap.values()],
    products: [...itemNames],
    warnings,
    stats,
  };
}

// ---- Example inputs (for docs / tests / the Setup page's "load example") ---

/** Well-formed export: spacer column, title lines, grouped subtotal row. */
export const EXAMPLE_CSV = `Casks & Barrels Ltd
Sales by Item Detail
"November 2026"
,Type,Date,Num,Name,Item,Qty,Sales Price,Amount
,Invoice,03/11/2026,2101,Savannah Grill:Karen,Excelsior Merlot,24,950.00,"22,800.00"
,Invoice,03/11/2026,2101,Savannah Grill:Karen,Crafty Distillery Gin,6,1600.00,"9,600.00"
,Invoice,10/11/2026,2118,The Rooftop Lounge,Bayede The Prince Merlot,12,1050.00,"12,600.00"
,Sales Receipt,12/11/2026,2124,Karen Wine Cellar,Excelsior Sauvignon Blanc,18,920.00,"16,560.00"
,Total Excelsior Merlot,,,,,24,,"22,800.00"
`;

/** The real-world gotcha: amounts but no Quantity column. */
export const EXAMPLE_CSV_NO_QTY = `Type,Date,Num,Name,Item,Amount
Invoice,03/11/2026,2101,Savannah Grill:Karen,Excelsior Merlot,"22,800.00"
Invoice,10/11/2026,2118,The Rooftop Lounge,Bayede The Prince Merlot,"12,600.00"
`;
