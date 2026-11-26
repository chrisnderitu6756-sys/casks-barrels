"use client";

import { useRef, useState, useTransition } from "react";
import { Badge, Card, SectionHeader, Stat } from "@/components/ui";
import { kes, longDate } from "@/lib/format";
import { productById } from "@/lib/data/sample-data";
import {
  EXAMPLE_CSV,
  EXAMPLE_CSV_NO_QTY,
  parseSalesByItemDetail,
  slugify,
  type ImportResult,
} from "@/lib/import/sales-by-item-detail";
import { commitImport, importSalesXlsx } from "./actions";

type XlsxSummary = {
  ok: boolean;
  ordersImported: number;
  accounts: number;
  products: number;
  message: string;
};

export function ImportPanel() {
  // --- Primary flow: upload the real QuickBooks .xlsx export -----------------
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxSummary, setXlsxSummary] = useState<XlsxSummary | null>(null);
  const [xlsxPending, startXlsx] = useTransition();
  const xlsxRef = useRef<HTMLInputElement>(null);

  // --- Secondary flow: paste / load a simplified CSV -------------------------
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [applied, setApplied] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onXlsx(file: File | undefined) {
    setXlsxSummary(null);
    setXlsxFile(file ?? null);
  }

  function importXlsx() {
    if (!xlsxFile) return;
    setXlsxSummary(null);
    const form = new FormData();
    form.append("file", xlsxFile);
    startXlsx(async () => {
      const res = await importSalesXlsx(form);
      setXlsxSummary(res);
    });
  }

  function apply() {
    if (!text.trim()) return;
    setApplied(null);
    startTransition(async () => {
      const res = await commitImport(text, fileName ?? undefined);
      setApplied({ ok: res.ok, message: res.message });
    });
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ""));
      setFileName(file.name);
      setResult(null);
      setApplied(null);
    };
    reader.readAsText(file);
  }

  function load(example: string) {
    setText(example);
    setFileName(null);
    setResult(null);
    setApplied(null);
  }

  const accountName = (id: string) => result?.accounts.find((a) => a.id === id)?.fullName ?? id;
  const productName = (id: string) =>
    productById(id)?.name ?? result?.products.find((p) => `unmatched-${slugify(p)}` === id) ?? id;

  return (
    <Card className="p-6">
      <SectionHeader
        title="Import sales data"
        intro={
          "Upload the QuickBooks “Sales by Item Detail” Excel export (.xlsx) straight from QuickBooks Desktop — the dashboard reads it directly, including the grouped-by-item layout. Imports are additive: orders already present are skipped, and existing customers keep their type, owner and area."
        }
      />

      {/* -------- Primary: upload the real .xlsx export -------- */}
      <div className="mt-5 rounded-xl border border-wine/20 bg-wine-soft/40 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={xlsxRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => onXlsx(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => xlsxRef.current?.click()}
            className="rounded-full bg-wine px-5 py-2 text-sm font-medium text-white hover:bg-wine/90"
          >
            Choose QuickBooks .xlsx file
          </button>
          {xlsxFile ? <span className="text-sm text-muted">{xlsxFile.name}</span> : null}
          {xlsxFile ? (
            <button
              type="button"
              onClick={() => {
                setXlsxFile(null);
                setXlsxSummary(null);
                if (xlsxRef.current) xlsxRef.current.value = "";
              }}
              className="text-sm text-muted hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!xlsxFile || xlsxPending}
            onClick={importXlsx}
            className="rounded-full bg-wine px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {xlsxPending ? "Importing…" : "Import to dashboard"}
          </button>
          <span className="text-xs text-faint">
            Reads the &ldquo;Sheet1&rdquo; data sheet, groups invoice lines into orders, and updates the freshness stamp.
          </span>
        </div>

        {xlsxSummary ? (
          xlsxSummary.ok ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-3 gap-6 rounded-xl bg-surface-2 p-5">
                <Stat value={xlsxSummary.ordersImported} label="Orders" hint="invoiced sales" />
                <Stat value={xlsxSummary.accounts} label="New customers" />
                <Stat value={xlsxSummary.products} label="Products" />
              </div>
              <div className="rounded-xl border border-healthy/30 bg-healthy/5 p-4 text-sm text-healthy">
                {xlsxSummary.message}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-risk/30 bg-risk/5 p-4 text-sm text-risk">
              {xlsxSummary.message}
            </div>
          )
        ) : null}
      </div>

      {/* -------- Secondary: paste a simplified CSV (preview) -------- */}
      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-sm font-semibold text-ink">Or paste a simplified CSV</h3>
        <p className="mt-1 text-sm text-muted">
          Paste a &ldquo;Sales by Item Detail&rdquo; export as CSV (or load a .csv file) to preview it before applying.
          Handy for a quick check; the .xlsx upload above is the usual path.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:bg-wine-soft"
          >
            Choose .csv file
          </button>
          {fileName ? <span className="text-sm text-muted">{fileName}</span> : null}
          <span className="text-xs text-faint">or try</span>
          <button type="button" onClick={() => load(EXAMPLE_CSV)} className="text-sm text-wine underline-offset-2 hover:underline">
            example export
          </button>
          <button type="button" onClick={() => load(EXAMPLE_CSV_NO_QTY)} className="text-sm text-wine underline-offset-2 hover:underline">
            export with no quantity column
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
            setApplied(null);
          }}
          rows={8}
          spellCheck={false}
          placeholder={"Type,Date,Num,Name,Item,Qty,Sales Price,Amount\nInvoice,03/11/2026,2101,Savannah Grill:Karen,Excelsior Merlot,24,950.00,22800.00"}
          className="mt-4 w-full rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-wine/30"
        />

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => setResult(parseSalesByItemDetail(text))}
            className="rounded-full bg-wine px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Preview import
          </button>
          {text ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                setFileName(null);
                setResult(null);
              }}
              className="text-sm text-muted hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </div>

        {result ? (
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-2 gap-6 rounded-xl bg-surface-2 p-5 sm:grid-cols-4">
              <Stat value={result.stats.orders} label="Orders" hint="invoiced sales" />
              <Stat value={result.stats.lineItems} label="Line items" />
              <Stat value={result.stats.customers} label="Customers" />
              <Stat value={result.stats.distinctProducts} label="Products" hint={`${result.stats.matchedProducts} matched`} />
            </div>

            {result.stats.dateRange ? (
              <p className="text-sm text-muted">
                {longDate(result.stats.dateRange.from)} to {longDate(result.stats.dateRange.to)} - {kes(result.stats.totalNet)} net invoiced.
              </p>
            ) : null}

            {result.warnings.length ? (
              <div className="rounded-xl border border-risk/30 bg-risk/5 p-4">
                <div className="text-sm font-semibold text-risk">
                  {result.warnings.length} {result.warnings.length === 1 ? "warning" : "warnings"}
                </div>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-risk">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-healthy/30 bg-healthy/5 p-4 text-sm text-healthy">
                No warnings - the export mapped cleanly.
              </div>
            )}

            {result.orders.length ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">Preview</h3>
                  <Badge>first {Math.min(6, result.orders.length)} of {result.orders.length} orders</Badge>
                </div>
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-surface-2 text-xs uppercase tracking-wide text-faint">
                      <tr>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Doc</th>
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">Lines</th>
                        <th className="px-3 py-2 text-right font-medium">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.orders.slice(0, 6).map((o) => (
                        <tr key={o.id} className="border-t border-line align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-muted">{longDate(o.date)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-ink">
                            #{o.number} <span className="text-faint">{o.docType === "invoice" ? "invoice" : "receipt"}</span>
                          </td>
                          <td className="px-3 py-2 text-ink">{accountName(o.accountId)}</td>
                          <td className="px-3 py-2 text-muted">
                            {o.lines.map((l, i) => (
                              <div key={i}>
                                {result.stats.hasQuantity ? `${l.quantity} x ` : ""}
                                {productName(l.productId)}
                              </div>
                            ))}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink">
                            {kes(o.lines.reduce((s, l) => s + l.netAmount, 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                type="button"
                disabled={pending || !result.stats.hasQuantity || result.orders.length === 0}
                onClick={apply}
                className="rounded-full bg-wine px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {pending ? "Applying…" : "Apply import"}
              </button>
              <span className="text-xs text-faint">
                Adds these orders to the live dashboard and updates the freshness stamp.
              </span>
            </div>

            {applied ? (
              <div
                className={
                  applied.ok
                    ? "rounded-xl border border-healthy/30 bg-healthy/5 p-4 text-sm text-healthy"
                    : "rounded-xl border border-risk/30 bg-risk/5 p-4 text-sm text-risk"
                }
              >
                {applied.message}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
