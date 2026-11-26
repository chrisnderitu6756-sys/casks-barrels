// ---------------------------------------------------------------------------
// Illustrative sample data for the Casks & Barrels demo.
// ALL customers and figures are fictional. This module is the single source
// behind the dashboard; a QuickBooks importer will populate the same shapes.
//
// Account profiles are tuned so the COMPUTED health engine reproduces the
// demo's portfolio: 4 at risk, 2 service issue, 5 healthy, 1 learning.
// ---------------------------------------------------------------------------

import type {
  Account,
  AccountType,
  Area,
  FollowUp,
  Order,
  OrderLine,
  Product,
  Rep,
  Visit,
} from "../types";

/** Stable demo clock (EAT). Health "days since last order" is measured from here. */
// Reference "today" for health: anchored to the latest date in James's export
// (the data runs 5 Jan – 26 Nov 2026). Kept as DEMO_TODAY so the many importers
// of it don't need to change; it is the as-of date the dashboard reasons from.
export const DEMO_TODAY = new Date("2026-11-26T18:00:00+03:00");

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
const iso = (d: Date) => d.toISOString();

// ---- People ---------------------------------------------------------------

export const reps: Rep[] = [
  { id: "james", name: "James Muhoro", role: "manager" },
  { id: "mary", name: "Mary W.", role: "rep" },
  { id: "peter", name: "Peter O.", role: "rep" },
  { id: "david", name: "David K.", role: "rep" },
];

export const repById = (id: string) => reps.find((r) => r.id === id);

// ---- Products -------------------------------------------------------------

export const products: Product[] = [
  { id: "excelsior-merlot", name: "Excelsior Merlot", supplier: "Excelsior", unitPriceNet: 950 },
  { id: "excelsior-sauvignon", name: "Excelsior Sauvignon Blanc", supplier: "Excelsior", unitPriceNet: 920 },
  { id: "excelsior-chardonnay", name: "Excelsior Chardonnay", supplier: "Excelsior", unitPriceNet: 940 },
  { id: "excelsior-sweet-red", name: "Excelsior Purebred Sweet Red", supplier: "Excelsior", unitPriceNet: 780 },
  { id: "bayede-merlot", name: "Bayede The Prince Merlot", supplier: "Bayede", unitPriceNet: 1050 },
  { id: "duchessa-lia", name: "Duchessa Lia Barbera", supplier: "Duchessa Lia", unitPriceNet: 1100 },
  { id: "crafty-gin", name: "Crafty Distillery Gin", supplier: "Crafty Distillery", unitPriceNet: 1600 },
  { id: "fragolino-rosso", name: "Fragolino Rosso", supplier: "Fragolino", unitPriceNet: 860 },
];

export const productById = (id: string) => products.find((p) => p.id === id);
const priceOf = (id: string) => productById(id)?.unitPriceNet ?? 1000;

// ---- Account profiles -----------------------------------------------------
// `lines` give the quantity on PRIOR orders and on the last 2 (RECENT) orders.
// A stable product uses the same prior/recent number.

interface ProfileLine {
  productId: string;
  prior: number;
  recent: number;
}

interface Profile {
  id: string;
  name: string;
  type: AccountType;
  area: Area;
  ownerId: string;
  cycleDays: number;
  lastOrderDaysAgo: number;
  orders: number;
  knownServiceIssue?: boolean;
  lines: ProfileLine[];
}

const profiles: Profile[] = [
  // --- At risk (4) ---
  { id: "acacia-house", name: "Acacia House", type: "Restaurant", area: "Westlands", ownerId: "mary", cycleDays: 14, lastOrderDaysAgo: 22, orders: 8,
    lines: [{ productId: "excelsior-merlot", prior: 25, recent: 9 }, { productId: "fragolino-rosso", prior: 12, recent: 12 }] },
  { id: "juniper-social", name: "Juniper Social", type: "Bar & lounge", area: "Kilimani", ownerId: "peter", cycleDays: 7, lastOrderDaysAgo: 13, orders: 8,
    lines: [{ productId: "crafty-gin", prior: 30, recent: 14 }, { productId: "excelsior-sauvignon", prior: 10, recent: 10 }] },
  { id: "ridgeway-cellars", name: "Ridgeway Cellars", type: "Retailer", area: "Westlands", ownerId: "mary", cycleDays: 14, lastOrderDaysAgo: 19, orders: 8,
    lines: [{ productId: "duchessa-lia", prior: 28, recent: 16 }, { productId: "excelsior-chardonnay", prior: 14, recent: 14 }] },
  { id: "terrace-kitchen", name: "The Terrace Kitchen", type: "Restaurant", area: "Karen", ownerId: "david", cycleDays: 14, lastOrderDaysAgo: 20, orders: 8,
    lines: [{ productId: "excelsior-sauvignon", prior: 30, recent: 14 }, { productId: "bayede-merlot", prior: 10, recent: 10 }] },

  // --- Service issue (2) ---
  { id: "palm-court", name: "Palm Court Hotel", type: "Hotel", area: "Karen", ownerId: "david", cycleDays: 14, lastOrderDaysAgo: 18, orders: 8, knownServiceIssue: true,
    lines: [{ productId: "excelsior-chardonnay", prior: 25, recent: 17 }, { productId: "duchessa-lia", prior: 15, recent: 15 }] },
  { id: "copper-vine", name: "Copper & Vine", type: "Retailer", area: "Kilimani", ownerId: "peter", cycleDays: 7, lastOrderDaysAgo: 10, orders: 8, knownServiceIssue: true,
    lines: [{ productId: "duchessa-lia", prior: 25, recent: 12 }, { productId: "excelsior-merlot", prior: 10, recent: 10 }] },

  // --- Healthy (5) ---
  { id: "fig-tree", name: "Fig Tree Bistro", type: "Restaurant", area: "Westlands", ownerId: "mary", cycleDays: 14, lastOrderDaysAgo: 5, orders: 8,
    lines: [{ productId: "excelsior-sauvignon", prior: 19, recent: 24 }, { productId: "fragolino-rosso", prior: 10, recent: 10 }] },
  { id: "olive-grove", name: "Olive Grove Hotel", type: "Hotel", area: "Karen", ownerId: "david", cycleDays: 14, lastOrderDaysAgo: 7, orders: 8,
    lines: [{ productId: "duchessa-lia", prior: 22, recent: 25 }, { productId: "bayede-merlot", prior: 12, recent: 12 }] },
  { id: "barrel-room", name: "Barrel Room", type: "Bar & lounge", area: "Kilimani", ownerId: "peter", cycleDays: 7, lastOrderDaysAgo: 3, orders: 8,
    lines: [{ productId: "crafty-gin", prior: 12, recent: 18 }, { productId: "excelsior-sweet-red", prior: 10, recent: 10 }] },
  { id: "cedar-market", name: "Cedar Market", type: "Retailer", area: "Westlands", ownerId: "mary", cycleDays: 14, lastOrderDaysAgo: 8, orders: 8,
    lines: [{ productId: "excelsior-merlot", prior: 25, recent: 29 }, { productId: "excelsior-chardonnay", prior: 12, recent: 12 }] },
  { id: "garden-table", name: "Garden Table", type: "Restaurant", area: "Karen", ownerId: "david", cycleDays: 14, lastOrderDaysAgo: 4, orders: 8,
    lines: [{ productId: "duchessa-lia", prior: 16, recent: 22 }, { productId: "fragolino-rosso", prior: 8, recent: 8 }] },

  // --- Learning (1) ---
  { id: "sable-wine-studio", name: "Sable Wine Studio", type: "Retailer", area: "Kilimani", ownerId: "peter", cycleDays: 10, lastOrderDaysAgo: 6, orders: 1,
    lines: [{ productId: "excelsior-sauvignon", prior: 18, recent: 18 }] },
];

// ---- Derive accounts + generated order history ----------------------------

export const accounts: Account[] = profiles.map((p) => ({
  id: p.id,
  name: p.name,
  type: p.type,
  area: p.area,
  ownerId: p.ownerId,
  cycleDays: p.cycleDays,
  knownServiceIssue: p.knownServiceIssue,
}));

export const accountById = (id: string) => accounts.find((a) => a.id === id);

let invoiceSeq = 21000;

function generateOrders(p: Profile): Order[] {
  const lastDate = addDays(DEMO_TODAY, -p.lastOrderDaysAgo);
  const out: Order[] = [];
  for (let i = 0; i < p.orders; i++) {
    const date = addDays(lastDate, -(p.orders - 1 - i) * p.cycleDays);
    const isRecent = i >= p.orders - 2; // last two orders carry the recent quantities
    const lines: OrderLine[] = p.lines.map((l) => {
      const quantity = isRecent ? l.recent : l.prior;
      return { productId: l.productId, quantity, netAmount: quantity * priceOf(l.productId) };
    });
    out.push({
      id: `${p.id}-o${i + 1}`,
      number: String(++invoiceSeq),
      accountId: p.id,
      date: iso(date),
      docType: "invoice",
      lines,
    });
  }
  return out;
}

export const orders: Order[] = profiles.flatMap(generateOrders);

export const ordersByAccount = (accountId: string) =>
  orders.filter((o) => o.accountId === accountId).sort((a, b) => (a.date < b.date ? -1 : 1));

// ---- Seeded field activity ------------------------------------------------

export const visits: Visit[] = [
  {
    id: "v1",
    accountId: "palm-court",
    repId: "david",
    at: iso(addDays(DEMO_TODAY, -9)),
    stockObs: "Excelsior Chardonnay low; two cases short-dated on the shelf.",
    displayObs: "Shelf display tidy but promo card missing.",
    feedback: "F&B manager unhappy about short-dated stock on the last drop.",
    nextStep: "Manager to resolve the short-dated stock complaint.",
  },
  {
    id: "v2",
    accountId: "acacia-house",
    repId: "mary",
    at: iso(addDays(DEMO_TODAY, -12)),
    stockObs: "Merlot down to a single case.",
    displayObs: "Wine list still features Excelsior Merlot.",
    feedback: "Owner hinted they are trialling another Merlot on price.",
    nextStep: "Call owner about the Merlot drop and confirm pricing.",
  },
  {
    id: "v3",
    accountId: "juniper-social",
    repId: "peter",
    at: iso(addDays(DEMO_TODAY, -8)),
    stockObs: "Gin well stocked but slower sell-through.",
    displayObs: "Back bar remodel in progress.",
    feedback: "Reorder slipped during the remodel; intend to resume.",
    nextStep: "Confirm the next reorder date.",
  },
];

export const followUps: FollowUp[] = [
  {
    id: "f1",
    accountId: "acacia-house",
    action: "Call owner about the Merlot drop and confirm pricing",
    ownerId: "mary",
    reviewDate: iso(addDays(DEMO_TODAY, -1)),
    status: "open",
    createdAt: iso(addDays(DEMO_TODAY, -12)),
    fromVisitId: "v2",
  },
  {
    id: "f2",
    accountId: "juniper-social",
    action: "Confirm the next reorder date after the remodel",
    ownerId: "peter",
    reviewDate: iso(addDays(DEMO_TODAY, 2)),
    status: "open",
    createdAt: iso(addDays(DEMO_TODAY, -8)),
    fromVisitId: "v3",
  },
  {
    id: "f3",
    accountId: "ridgeway-cellars",
    action: "Review the shrinking basket and propose a range refresh",
    ownerId: "mary",
    reviewDate: iso(addDays(DEMO_TODAY, 3)),
    status: "open",
    createdAt: iso(addDays(DEMO_TODAY, -4)),
  },
  {
    id: "f4",
    accountId: "palm-court",
    action: "Resolve the short-dated stock complaint",
    ownerId: "david",
    reviewDate: iso(addDays(DEMO_TODAY, -3)),
    status: "open",
    createdAt: iso(addDays(DEMO_TODAY, -9)),
    fromVisitId: "v1",
  },
  {
    id: "f5",
    accountId: "copper-vine",
    action: "Operational fix: tighten delivery timing",
    ownerId: "peter",
    reviewDate: iso(addDays(DEMO_TODAY, 1)),
    status: "open",
    createdAt: iso(addDays(DEMO_TODAY, -5)),
  },
  {
    id: "f6",
    accountId: "terrace-kitchen",
    action: "Introduce the Excelsior promo to lift Sauvignon",
    ownerId: "david",
    reviewDate: iso(addDays(DEMO_TODAY, -10)),
    status: "closed",
    createdAt: iso(addDays(DEMO_TODAY, -24)),
    declineReason: "Owner wanted to wait until after the quiet season.",
  },
];

/** Share of planned visits logged, per rep — seeds the adoption review. */
export const visitLogging: { repId: string; planned: number; logged: number }[] = [
  { repId: "mary", planned: 8, logged: 6 },
  { repId: "peter", planned: 7, logged: 4 },
  { repId: "david", planned: 6, logged: 5 },
];
