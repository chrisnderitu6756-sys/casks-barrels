// ---------------------------------------------------------------------------
// QuickBooks "Sales by Item Detail" — real .xlsx importer (parsing core)
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS
// `sales-by-item-detail.ts` parses the *simplified* pasted CSV. The client's
// REAL QuickBooks Desktop export is an .xlsx file with a very different shape:
//
//   - The workbook has two sheets. The first ("QuickBooks Export Tips") is
//     empty boiler-plate; the data lives in "Sheet1".
//   - "Sheet1" has a few title lines, then a HEADER ROW whose labels sit at
//     SPACED column positions with blank spacer columns between them:
//       Type, Date, Num, Memo, Name, Qty, U/M, Sales Price, Amount, Balance
//   - The report is GROUPED BY ITEM: each product has a section-header row and
//     a "Total …" subtotal row. Those are NOT transactions.
//
// A real transaction row has:
//     Type ∈ {Invoice, Sales Receipt, Credit Note}  AND  a non-empty Name
//     AND  a non-empty Memo.
// For such a row the mapping is:
//     PRODUCT   = Memo        CUSTOMER    = Name
//     quantity  = Qty         amount      = Amount      unit price = Sales Price
//
// This module is PURE (no I/O, no React). The server action reads the file with
// SheetJS and hands us the raw 2-D cell array (`XLSX.utils.sheet_to_json(sheet,
// { header: 1, raw: true, defval: null })`), so date cells arrive as
// `Date | number (Excel serial) | string` — all handled by `toISODate`.
// ---------------------------------------------------------------------------

import { parseNumber } from "./sales-by-item-detail";

/** A raw cell as SheetJS yields it with { header: 1, raw: true }. */
export type Cell = string | number | boolean | Date | null | undefined;

export type DocType = "invoice" | "sales-receipt" | "credit-note";

export interface ParsedXlsxLine {
  productId: string;
  quantity: number;
  netAmount: number;
}

export interface ParsedXlsxOrder {
  id: string;
  number: string;
  accountId: string;
  /** ISO date (YYYY-MM-DD). The caller turns this into `new Date(iso)`. */
  iso: string;
  docType: DocType;
  lines: ParsedXlsxLine[];
}

export interface ParsedXlsxAccount {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ParsedXlsxProduct {
  id: string;
  name: string;
  /** A representative positive Sales Price for the product (median positive). */
  unitPriceNet: number;
}

export interface ParsedXlsx {
  orders: ParsedXlsxOrder[];
  /** Distinct accounts seen — customers plus any "Parent:" accounts. */
  accounts: ParsedXlsxAccount[];
  products: ParsedXlsxProduct[];
  /** Transaction rows that became order lines. */
  rowsImported: number;
  /** The header labels that were located, for diagnostics. */
  columns: Partial<Record<ColumnKey, string>>;
}

export type ColumnKey = "type" | "date" | "num" | "memo" | "name" | "qty" | "price" | "amount";

// ---- Slug (matches the project's id scheme) --------------------------------

/**
 * "Savannah Grill & Bar" -> "savannah-grill-and-bar". Lowercase, "&" -> " and ",
 * runs of non-[a-z0-9] collapse to "-", trimmed, capped at 120 chars.
 */
export function slug(input: string): string {
  return String(input)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

// ---- Cell coercion ---------------------------------------------------------

const normCell = (v: Cell): string => String(v ?? "").trim();
const pad = (n: number) => String(n).padStart(2, "0");

/** Number from a raw cell: numeric cells pass through; strings via parseNumber. */
function toNumber(v: Cell): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return parseNumber(String(v));
}

/**
 * Coerce a date cell to an ISO date string (YYYY-MM-DD). Handles the three
 * shapes SheetJS can produce with { raw: true } / { cellDates: true }:
 *   - Date object  → use its (local) calendar parts, which SheetJS sets to the
 *     date as displayed in the sheet.
 *   - number       → Excel serial day count (epoch 1899-12-30; serial 25569 is
 *     1970-01-01) → convert via UTC so there is no timezone drift.
 *   - string       → "YYYY-MM-DD" or UK day-first "dd/mm/yyyy".
 */
export function toISODate(v: Cell): string | null {
  if (v === null || v === undefined || v === "") return null;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }

  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const dt = new Date(ms);
    if (Number.isNaN(dt.getTime())) return null;
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  const str = String(v).trim();
  let m: RegExpMatchArray | null;
  if ((m = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
  }
  if ((m = str.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/))) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`; // QuickBooks UK: day-first
  }
  return null;
}

// ---- Header mapping --------------------------------------------------------

/** Header label (normalised) expected for each canonical field. */
const WANT: Record<ColumnKey, string> = {
  type: "type",
  date: "date",
  num: "num",
  memo: "memo",
  name: "name",
  qty: "qty",
  price: "sales price",
  amount: "amount",
};

/** The labels that MUST be on a row for it to count as the header row. */
const REQUIRED: ColumnKey[] = ["type", "date", "name", "amount"];

type ColumnMap = Partial<Record<ColumnKey, number>>;

/** "Invoice", "Sales Receipt", "Credit Note" (any case) → our docType enum. */
const DOC_TYPES: Record<string, DocType> = {
  invoice: "invoice",
  "sales receipt": "sales-receipt",
  "credit note": "credit-note",
};

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(med * 100) / 100;
}

// ---- Main ------------------------------------------------------------------

/**
 * Parse the raw 2-D cell array of the QuickBooks "Sales by Item Detail"
 * "Sheet1" into grouped orders, accounts and products.
 *
 * @throws if no header row (Type/Date/Name/Amount) can be located.
 */
export function parseGroupedSalesRows(rows: Cell[][]): ParsedXlsx {
  // 1) Locate the header row: the first row that carries Type, Date, Name and
  //    Amount. Build a label → column-index map from it (robust to the blank
  //    spacer columns, since we look up by label, never by a fixed index).
  let headerAt = -1;
  const colMap: ColumnMap = {};
  const columns: Partial<Record<ColumnKey, string>> = {};

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i] ?? [];
    const normed = cells.map((c) => normCell(c).toLowerCase());
    if (REQUIRED.every((k) => normed.includes(WANT[k]))) {
      headerAt = i;
      (Object.keys(WANT) as ColumnKey[]).forEach((key) => {
        const idx = normed.indexOf(WANT[key]);
        if (idx >= 0) {
          colMap[key] = idx;
          columns[key] = normCell(cells[idx]);
        }
      });
      break;
    }
  }

  if (headerAt < 0) {
    throw new Error(
      'Could not find the "Sales by Item Detail" header row (expected columns Type, Date, Name and Amount on one row). ' +
        "Make sure this is the QuickBooks export and that its data sheet is selected.",
    );
  }

  const cellAt = (cells: Cell[], key: ColumnKey): Cell =>
    colMap[key] === undefined ? null : cells[colMap[key]!];
  const strAt = (cells: Cell[], key: ColumnKey): string => normCell(cellAt(cells, key));

  // 2) Walk the data rows, keeping only real transaction rows and grouping them
  //    into orders by (Type, Num, Date, Name).
  const orders = new Map<string, ParsedXlsxOrder>();
  const accounts = new Map<string, ParsedXlsxAccount>();
  const productPrices = new Map<string, { name: string; prices: number[] }>();
  let rowsImported = 0;

  for (let i = headerAt + 1; i < rows.length; i++) {
    const cells = rows[i] ?? [];

    const docType = DOC_TYPES[strAt(cells, "type").toLowerCase()];
    if (!docType) continue; // section headers, "Total …" rows, blanks, other types

    const name = strAt(cells, "name");
    const memo = strAt(cells, "memo");
    if (!name || !memo) continue; // not a transaction line

    const iso = toISODate(cellAt(cells, "date"));
    if (!iso) continue; // can't place it in time → skip

    const num = strAt(cells, "num");
    const qty = toNumber(cellAt(cells, "qty")) ?? 0;
    const amount = toNumber(cellAt(cells, "amount")) ?? 0;
    const price = toNumber(cellAt(cells, "price"));

    // Customer / account (+ optional "Parent:Branch").
    const accountId = slug(name);
    const colon = name.indexOf(":");
    let parentId: string | null = null;
    let displayName = name;
    if (colon > 0 && colon < name.length - 1) {
      const parentName = name.slice(0, colon).trim();
      displayName = name.slice(colon + 1).trim();
      parentId = slug(parentName);
      if (parentId && !accounts.has(parentId)) {
        accounts.set(parentId, { id: parentId, name: parentName, parentId: null });
      }
    }
    // The customer row wins over a bare parent entry of the same id.
    accounts.set(accountId, { id: accountId, name: displayName, parentId });

    // Product (keyed by its Memo).
    const productId = slug(memo);
    const bucket = productPrices.get(productId) ?? { name: memo, prices: [] };
    if (price !== null && price > 0) bucket.prices.push(price);
    productPrices.set(productId, bucket);

    // Group into an order. Credit notes carry negative qty/amount — kept as-is.
    const orderId = `${accountId}-${slug(String(num))}-${iso}`;
    const key = `${docType}|${num}|${iso}|${accountId}`;
    let order = orders.get(key);
    if (!order) {
      order = { id: orderId, number: String(num), accountId, iso, docType, lines: [] };
      orders.set(key, order);
    }
    order.lines.push({
      productId,
      quantity: Math.round(qty || 0),
      netAmount: Math.round((amount || 0) * 100) / 100,
    });
    rowsImported++;
  }

  const products: ParsedXlsxProduct[] = [...productPrices.entries()].map(([id, p]) => ({
    id,
    name: p.name,
    unitPriceNet: median(p.prices),
  }));

  return {
    orders: [...orders.values()],
    accounts: [...accounts.values()],
    products,
    rowsImported,
    columns,
  };
}
