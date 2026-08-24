import { RANKS, SUITS, type Card, type Rank, type Suit } from "./types";

export function createRng(seed: number) {
  let s = seed >>> 0 || 1;
  return {
    next() {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    },
    int(n: number) {
      if (n <= 0) return 0;
      return Math.floor(this.next() * n);
    },
    pick<T>(arr: readonly T[]): T {
      return arr[this.int(arr.length)]!;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.int(i + 1);
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
  };
}

export function buildShoe(): Card[] {
  const cards: Card[] = [];
  for (const pack of [0, 1] as const) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${pack}-${suit}-${rank}`,
          suit,
          rank,
          pack,
        });
      }
    }
    cards.push({
      id: `${pack}-J-JOKER`,
      suit: "J",
      rank: "JOKER",
      pack,
    });
  }
  return cards;
}

export function isJoker(card: Card, wildRank: Rank | null): boolean {
  if (card.rank === "JOKER") return true;
  return wildRank !== null && card.rank === wildRank;
}

export function cardPoints(card: Card, wildRank: Rank | null): number {
  if (isJoker(card, wildRank)) return 0;
  if (card.rank === "A" || card.rank === "J" || card.rank === "Q" || card.rank === "K") {
    return 10;
  }
  return Number(card.rank);
}

export function handPoints(cards: Card[], wildRank: Rank | null): number {
  return cards.reduce((sum, c) => sum + cardPoints(c, wildRank), 0);
}

export function findCard(cards: Card[], id: string): Card | undefined {
  return cards.find((c) => c.id === id);
}

export function flattenGroups(groups: string[][], byId: Map<string, Card>): Card[] {
  const out: Card[] = [];
  for (const g of groups) {
    for (const id of g) {
      const c = byId.get(id);
      if (c) out.push(c);
    }
  }
  return out;
}

export function cardsById(cards: Card[]): Map<string, Card> {
  return new Map(cards.map((c) => [c.id, c]));
}

export function sortCards(cards: Card[], wildRank: Rank | null): Card[] {
  const suitOrder: Record<string, number> = { S: 0, H: 1, D: 2, C: 3, J: 4 };
  return cards.slice().sort((a, b) => {
    const aj = isJoker(a, wildRank) ? 1 : 0;
    const bj = isJoker(b, wildRank) ? 1 : 0;
    if (aj !== bj) return aj - bj;
    if (a.suit !== b.suit) return (suitOrder[a.suit] ?? 9) - (suitOrder[b.suit] ?? 9);
    const ar = a.rank === "JOKER" ? 99 : RANKS.indexOf(a.rank as Rank);
    const br = b.rank === "JOKER" ? 99 : RANKS.indexOf(b.rank as Rank);
    return ar - br;
  });
}

export function displayRank(card: Card): string {
  if (card.rank === "JOKER") return "J";
  return card.rank;
}

export function isRed(suit: Suit | "J"): boolean {
  return suit === "H" || suit === "D";
}
