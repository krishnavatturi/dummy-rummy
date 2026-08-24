export const SUITS = ["S", "H", "D", "C"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export type Card = {
  id: string;
  suit: Suit | "J";
  rank: Rank | "JOKER";
  pack: 0 | 1;
};

export type Variant = "points" | "pool101" | "pool201" | "deals";

export type TableSeat = {
  id: string;
  name: string;
  isBot: boolean;
  avatarHue: number;
};

export type TableConfig = {
  id: string;
  name: string;
  variant: Variant;
  seats: number;
  pointValue: number;
  deals?: number;
  entryFee: number;
};

export type PlayerStatus = "active" | "dropped" | "declared" | "eliminated";

export type Group = string[];

export type SeatState = {
  id: string;
  name: string;
  isBot: boolean;
  avatarHue: number;
  groups: Group[];
  status: PlayerStatus;
  hasDrawnThisHand: boolean;
  /** Points accumulated in pool / deals */
  matchPoints: number;
  lastHandPoints: number;
  chipsDelta: number;
};

export type Phase =
  | "idle"
  | "draw"
  | "discard"
  | "show"
  | "between"
  | "matchOver";

export type LogEvent = {
  id: number;
  text: string;
};

export type ShowResult = {
  winnerId: string | null;
  reason: "declare" | "invalid" | "drop" | "lastStanding";
  scores: { id: string; name: string; points: number; valid: boolean }[];
};

export type GameState = {
  table: TableConfig;
  seed: number;
  handNumber: number;
  dealerIndex: number;
  turn: number;
  phase: Phase;
  wildRank: Rank | null;
  wildCard: Card | null;
  closed: Card[];
  open: Card[];
  seats: SeatState[];
  drawnCardId: string | null;
  show: ShowResult | null;
  log: LogEvent[];
  logSeq: number;
  winnerId: string | null;
  pot: number;
};

export function rankIndex(rank: Rank | "JOKER"): number {
  if (rank === "JOKER") return -1;
  return RANKS.indexOf(rank);
}

export function nextRank(rank: Rank): Rank | null {
  const i = RANKS.indexOf(rank);
  if (i < 0 || i === RANKS.length - 1) return null;
  return RANKS[i + 1];
}

export function prevRank(rank: Rank): Rank | null {
  const i = RANKS.indexOf(rank);
  if (i <= 0) return null;
  return RANKS[i - 1];
}

export function suitSymbol(suit: Suit | "J"): string {
  switch (suit) {
    case "S":
      return "♠";
    case "H":
      return "♥";
    case "D":
      return "♦";
    case "C":
      return "♣";
    default:
      return "★";
  }
}

export function suitName(suit: Suit | "J"): string {
  switch (suit) {
    case "S":
      return "Spades";
    case "H":
      return "Hearts";
    case "D":
      return "Diamonds";
    case "C":
      return "Clubs";
    default:
      return "Joker";
  }
}
