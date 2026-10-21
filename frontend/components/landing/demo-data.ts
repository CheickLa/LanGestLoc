// Galerie fictive de la page d'accueil, figée au 21 octobre 2026.

export type CellState = "paid" | "advance" | "pending" | "late" | "future" | "none";

export type RegisterRow = {
  code: string;
  trade: string;
  rent: number;
  /** Un état par mois de REGISTER_MONTHS ; null pour une boutique vacante. */
  cells: CellState[] | null;
  notes?: Partial<Record<number, string>>;
};

export const REGISTER_MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

export const CURRENT_MONTH_INDEX = 3;

export const REGISTER_ROWS: RegisterRow[] = [
  {
    code: "A1",
    trade: "Téléphonie",
    rent: 1_800_000,
    cells: ["paid", "paid", "paid", "paid", "future", "future"],
    notes: { 3: "payé le 2 octobre, en espèces." },
  },
  {
    code: "A2",
    trade: "Pièces auto",
    rent: 2_000_000,
    cells: ["none", "none", "none", "paid", "advance", "advance"],
    notes: {
      3: "payé le 1er octobre par Orange Money, avec novembre et décembre : un seul reçu pour les trois mois.",
      4: "payé d'avance le 1er octobre, par Orange Money.",
      5: "payé d'avance le 1er octobre, par Orange Money.",
    },
  },
  {
    code: "A3",
    trade: "Alimentation",
    rent: 1_800_000,
    cells: ["paid", "paid", "paid", "pending", "future", "future"],
    notes: { 3: "en attente, à régler avant le 5 novembre." },
  },
  {
    code: "A4",
    trade: "Quincaillerie",
    rent: 2_000_000,
    cells: ["paid", "paid", "paid", "paid", "future", "future"],
    notes: { 3: "payé le 4 octobre, par Mobile Money." },
  },
  {
    code: "B1",
    trade: "Tissus",
    rent: 1_200_000,
    cells: ["paid", "paid", "paid", "paid", "future", "future"],
    notes: { 3: "payé le 5 octobre, par Orange Money." },
  },
  {
    code: "B2",
    trade: "Couture",
    rent: 1_200_000,
    cells: ["paid", "paid", "late", "pending", "future", "future"],
    notes: {
      2: "en retard depuis le 6 octobre, le loyer reste à régler.",
      3: "en attente, à régler avant le 5 novembre.",
    },
  },
  {
    code: "B3",
    trade: "Cosmétiques",
    rent: 1_200_000,
    cells: ["paid", "paid", "paid", "paid", "future", "future"],
    notes: { 3: "payé le 3 octobre, en espèces." },
  },
  { code: "B4", trade: "Libre", rent: 0, cells: null },
];

export const COLLECTED_BY_MONTH = [
  { month: "2026-05", amount: 9_000_000 },
  { month: "2026-06", amount: 8_400_000 },
  { month: "2026-07", amount: 9_600_000 },
  { month: "2026-08", amount: 9_000_000 },
  { month: "2026-09", amount: 7_800_000 },
  { month: "2026-10", amount: 12_200_000 },
];

const occupied = REGISTER_ROWS.filter((row) => row.cells !== null);
const currentStates = occupied.map((row) => row.cells?.[CURRENT_MONTH_INDEX]);
const expected = occupied.reduce((sum, row) => sum + row.rent, 0);
const settled = occupied
  .filter((row) => row.cells?.[CURRENT_MONTH_INDEX] === "paid")
  .reduce((sum, row) => sum + row.rent, 0);

export const DASHBOARD = {
  activeContracts: occupied.length,
  locals: REGISTER_ROWS.length,
  collected: COLLECTED_BY_MONTH[COLLECTED_BY_MONTH.length - 1].amount,
  payments: currentStates.filter((state) => state === "paid").length,
  late: occupied.flatMap((row) =>
    (row.cells ?? []).flatMap((state, i) => (state === "late" ? [{ row, month: REGISTER_MONTHS[i] }] : [])),
  ),
  duesPaid: currentStates.filter((state) => state === "paid").length,
  duesPending: currentStates.filter((state) => state === "pending").length,
  recovery: Math.round((settled / expected) * 100),
};
