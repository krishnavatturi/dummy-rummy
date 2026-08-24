import type { TableConfig } from "./types";

export const BOT_NAMES = [
  "Rohan",
  "Priya",
  "Arjun",
  "Meera",
  "Kabir",
  "Ananya",
  "Vikram",
  "Isha",
];

export const PRACTICE_START_CHIPS = 100_000;

export const LOBBY_TABLES: TableConfig[] = [
  {
    id: "pts-2-1",
    name: "Points · 2 Players",
    variant: "points",
    seats: 2,
    pointValue: 1,
    entryFee: 0,
  },
  {
    id: "pts-2-5",
    name: "Points · High 2P",
    variant: "points",
    seats: 2,
    pointValue: 5,
    entryFee: 0,
  },
  {
    id: "pts-6-2",
    name: "Points · 6 Players",
    variant: "points",
    seats: 6,
    pointValue: 2,
    entryFee: 0,
  },
  {
    id: "pool-101-2",
    name: "101 Pool · 2 Players",
    variant: "pool101",
    seats: 2,
    pointValue: 0,
    entryFee: 1000,
  },
  {
    id: "pool-101-6",
    name: "101 Pool · 6 Players",
    variant: "pool101",
    seats: 6,
    pointValue: 0,
    entryFee: 2500,
  },
  {
    id: "pool-201-6",
    name: "201 Pool · 6 Players",
    variant: "pool201",
    seats: 6,
    pointValue: 0,
    entryFee: 5000,
  },
  {
    id: "deals-2-2",
    name: "Deals · Best of 2",
    variant: "deals",
    seats: 2,
    pointValue: 0,
    entryFee: 800,
    deals: 2,
  },
  {
    id: "deals-3-6",
    name: "Deals · 3 Hands",
    variant: "deals",
    seats: 6,
    pointValue: 0,
    entryFee: 1500,
    deals: 3,
  },
];

export function formatChips(n: number): string {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(Math.round(n));
  return sign + v.toLocaleString("en-IN");
}

export function variantLabel(v: TableConfig["variant"]): string {
  switch (v) {
    case "points":
      return "Points Rummy";
    case "pool101":
      return "101 Pool";
    case "pool201":
      return "201 Pool";
    case "deals":
      return "Deals Rummy";
  }
}

export function tableBlurb(t: TableConfig): string {
  if (t.variant === "points") return `₹${t.pointValue} / point · winner takes the table`;
  if (t.variant === "deals") return `${t.deals} deals · entry ${formatChips(t.entryFee)} chips`;
  return `Entry ${formatChips(t.entryFee)} chips · last player standing wins the pot`;
}
