import { cardPoints, isJoker } from "./cards";
import { RANKS, type Card, type Rank } from "./types";

const MAX_POINTS = 80;

function bitCount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function naturalRankIndex(card: Card, wildRank: Rank | null): number | null {
  if (isJoker(card, wildRank)) return null;
  if (card.rank === "JOKER") return null;
  return RANKS.indexOf(card.rank);
}

/** Consecutive same-suit run. Ace may be low (A-2-3) or high (Q-K-A), never wrap (K-A-2). */
export function isSequence(cards: Card[], wildRank: Rank | null, requirePure: boolean): boolean {
  if (cards.length < 3) return false;
  const jokers = cards.filter((c) => isJoker(c, wildRank));
  const naturals = cards.filter((c) => !isJoker(c, wildRank));
  if (requirePure && jokers.length > 0) return false;
  if (naturals.length === 0) return false;
  const suit = naturals[0]!.suit;
  if (suit === "J") return false;
  if (!naturals.every((c) => c.suit === suit)) return false;

  const idxs = naturals
    .map((c) => naturalRankIndex(c, wildRank))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (idxs.length !== naturals.length) return false;
  if (new Set(idxs).size !== idxs.length) return false;

  return canPlaceRun(idxs, jokers.length);
}

function canPlaceRun(sortedIdxs: number[], jokers: number): boolean {
  const variants: number[][] = [sortedIdxs];
  if (sortedIdxs.includes(0)) {
    const highAce = sortedIdxs.filter((i) => i !== 0).concat([13]).sort((a, b) => a - b);
    variants.push(highAce);
  }
  for (const idxs of variants) {
    if (idxs.some((i) => i < 0 || i > 13)) continue;
    if (new Set(idxs).size !== idxs.length) continue;
    const min = idxs[0]!;
    const max = idxs[idxs.length - 1]!;
    const span = max - min + 1;
    const gaps = span - idxs.length;
    if (gaps < 0 || gaps > jokers) continue;
    const leftover = jokers - gaps;
    const leftRoom = min;
    const rightRoom = 13 - max;
    if (leftover <= leftRoom + rightRoom) return true;
  }
  return false;
}

export function isSet(cards: Card[], wildRank: Rank | null): boolean {
  if (cards.length < 3 || cards.length > 4) return false;
  const naturals = cards.filter((c) => !isJoker(c, wildRank));
  if (naturals.length === 0) return false;
  const rank = naturals[0]!.rank;
  if (rank === "JOKER") return false;
  if (!naturals.every((c) => c.rank === rank)) return false;
  return true;
}

export function isPureSequence(cards: Card[], wildRank: Rank | null): boolean {
  return isSequence(cards, wildRank, true);
}

export function isImpureSequence(cards: Card[], wildRank: Rank | null): boolean {
  return isSequence(cards, wildRank, false) && !isSequence(cards, wildRank, true);
}

export function isValidMeld(cards: Card[], wildRank: Rank | null): boolean {
  return isSequence(cards, wildRank, false) || isSet(cards, wildRank);
}

export type MeldKind = "pure" | "seq" | "set";

export type HandAnalysis = {
  score: number;
  canDeclare: boolean;
  hasLife: boolean;
  pureCount: number;
  sequenceCount: number;
  groups: Card[][];
  leftover: Card[];
};

function meldKind(cards: Card[], wildRank: Rank | null): MeldKind | null {
  if (isPureSequence(cards, wildRank)) return "pure";
  if (isSequence(cards, wildRank, false)) return "seq";
  if (isSet(cards, wildRank)) return "set";
  return null;
}

/**
 * Exact min-point grouping via bitmask DP (n ≤ 14).
 * Life = ≥1 pure sequence and ≥2 sequences total.
 * Without a second sequence, only a single pure sequence is exempt from scoring.
 */
export function analyzeHand(cards: Card[], wildRank: Rank | null): HandAnalysis {
  const n = cards.length;
  const allPts = Math.min(
    MAX_POINTS,
    cards.reduce((s, c) => s + cardPoints(c, wildRank), 0),
  );

  const empty: HandAnalysis = {
    score: allPts,
    canDeclare: false,
    hasLife: false,
    pureCount: 0,
    sequenceCount: 0,
    groups: [],
    leftover: cards.slice(),
  };

  if (n === 0) {
    return { ...empty, leftover: [], score: 0 };
  }
  if (n > 14) return empty;

  const N = 1 << n;
  const kind = new Int8Array(N); // 0 none, 1 set, 2 seq, 3 pure
  const subset: Card[] = [];

  for (let mask = 1; mask < N; mask++) {
    const size = bitCount(mask);
    if (size < 3 || size > 8) continue;
    subset.length = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(cards[i]!);
    const k = meldKind(subset, wildRank);
    if (k === "pure") kind[mask] = 3;
    else if (k === "seq") kind[mask] = 2;
    else if (k === "set") kind[mask] = 1;
  }

  type Stat = { seqs: number; pures: number; parent: number; meld: number };
  const reachable: (Stat | null)[] = Array(N).fill(null);
  reachable[0] = { seqs: 0, pures: 0, parent: -1, meld: 0 };

  for (let mask = 1; mask < N; mask++) {
    let best: Stat | null = null;
    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      const k = kind[sub]!;
      if (!k) continue;
      const prev = mask ^ sub;
      const st = reachable[prev];
      if (!st) continue;
      const seqs = st.seqs + (k >= 2 ? 1 : 0);
      const pures = st.pures + (k === 3 ? 1 : 0);
      if (!best || pures > best.pures || (pures === best.pures && seqs > best.seqs)) {
        best = { seqs, pures, parent: prev, meld: sub };
      }
    }
    reachable[mask] = best;
  }

  const pointsOf = (mask: number) => {
    let p = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) p += cardPoints(cards[i]!, wildRank);
    return p;
  };

  const recover = (mask: number): Card[][] => {
    const groups: Card[][] = [];
    let m = mask;
    while (m && reachable[m] && reachable[m]!.meld) {
      const st = reachable[m]!;
      const g: Card[] = [];
      for (let i = 0; i < n; i++) if (st.meld & (1 << i)) g.push(cards[i]!);
      groups.push(g);
      m = st.parent;
    }
    return groups;
  };

  const leftoverCards = (covered: number): Card[] => {
    const out: Card[] = [];
    for (let i = 0; i < n; i++) if (!(covered & (1 << i))) out.push(cards[i]!);
    return out;
  };

  let bestScore = allPts;
  let bestCover = 0;
  let bestLife = false;
  let bestPures = 0;
  let bestSeqs = 0;

  const full = N - 1;
  for (let mask = 0; mask < N; mask++) {
    const st = reachable[mask];
    if (!st) continue;
    const leftoverMask = full ^ mask;
    const leftoverPts = Math.min(MAX_POINTS, pointsOf(leftoverMask));

    if (st.pures >= 1 && st.seqs >= 2) {
      if (leftoverPts < bestScore || (leftoverPts === bestScore && bitCount(mask) > bitCount(bestCover))) {
        bestScore = leftoverPts;
        bestCover = mask;
        bestLife = true;
        bestPures = st.pures;
        bestSeqs = st.seqs;
      }
    } else if (st.pures >= 1 && st.seqs === 1 && st.pures === 1) {
      // Single pure sequence; ignore any sets that might have been mixed in by requiring
      // the covered mask to be exactly that one meld — handled because seqs===1 and
      // parent chain has only the pure (sets would keep seqs===1 but pures===1 with extra set).
      // Extra sets would still be in `mask`, incorrectly saving those cards. Skip if mask
      // has more than the pure meld: detect via parent of mask being 0 and kind pure,
      // or walk the chain and ensure only pure melds.
      if (!partitionIsOnlyPures(reachable, mask, kind)) continue;
      if (leftoverPts < bestScore) {
        bestScore = leftoverPts;
        bestCover = mask;
        bestLife = false;
        bestPures = st.pures;
        bestSeqs = st.seqs;
      }
    }
  }

  const groups = recover(bestCover);
  const leftover = leftoverCards(bestCover);
  const canDeclare = n === 13 && bestLife && leftover.length === 0;

  return {
    score: Math.min(MAX_POINTS, bestScore),
    canDeclare,
    hasLife: bestLife,
    pureCount: bestPures,
    sequenceCount: bestSeqs,
    groups,
    leftover,
  };
}

function partitionIsOnlyPures(
  reachable: ({ parent: number; meld: number } | null)[],
  mask: number,
  kind: Int8Array,
): boolean {
  let m = mask;
  while (m && reachable[m] && reachable[m]!.meld) {
    const st = reachable[m]!;
    if (kind[st.meld] !== 3) return false;
    m = st.parent;
  }
  return true;
}

export function evaluateGroups(
  groups: Card[][],
  wildRank: Rank | null,
): { validDeclare: boolean; score: number; messages: string[] } {
  const messages: string[] = [];
  let sequences = 0;
  let pures = 0;
  let invalid = 0;
  const leftover: Card[] = [];
  const unsafeMelds: Card[] = [];

  for (const g of groups) {
    if (g.length === 0) continue;
    if (g.length < 3) {
      leftover.push(...g);
      continue;
    }
    if (isPureSequence(g, wildRank)) {
      sequences++;
      pures++;
    } else if (isSequence(g, wildRank, false)) {
      sequences++;
      unsafeMelds.push(...g);
    } else if (isSet(g, wildRank)) {
      unsafeMelds.push(...g);
    } else {
      invalid++;
      leftover.push(...g);
      messages.push("A group is not a valid sequence or set.");
    }
  }

  const hasLife = pures >= 1 && sequences >= 2;
  const allCards = groups.flat();
  const n = allCards.length;

  if (hasLife) {
    const score = Math.min(MAX_POINTS, leftover.reduce((s, c) => s + cardPoints(c, wildRank), 0));
    const validDeclare = n === 13 && leftover.length === 0 && invalid === 0;
    if (pures < 1) messages.push("Need one pure sequence (without jokers).");
    if (sequences < 2) messages.push("Need at least two sequences.");
    return { validDeclare, score, messages };
  }

  if (pures >= 1) {
    const rest = [...unsafeMelds, ...leftover];
    const score = Math.min(MAX_POINTS, rest.reduce((s, c) => s + cardPoints(c, wildRank), 0));
    messages.push("Need a second sequence before sets count.");
    return { validDeclare: false, score, messages };
  }

  const score = Math.min(
    MAX_POINTS,
    allCards.reduce((s, c) => s + cardPoints(c, wildRank), 0),
  );
  messages.push("Need one pure sequence and a second sequence to declare.");
  return { validDeclare: false, score, messages };
}

export const DECLARE_PENALTY = MAX_POINTS;
export const FIRST_DROP = 20;
export const MIDDLE_DROP = 40;
