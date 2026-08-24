import { analyzeHand } from "./melds";
import {
  autoArrange,
  currentSeat,
  declare,
  discard,
  drawClosed,
  drawOpen,
  drop,
  getSeatCards,
  lookupCard,
  openTop,
} from "./engine";
import { cardPoints, createRng, isJoker } from "./cards";
import type { Card, GameState, Rank } from "./types";

function usefulOpenCard(hand: Card[], open: Card, wildRank: Rank | null): boolean {
  if (isJoker(open, wildRank)) return true;
  const trial = analyzeHand([...hand, open], wildRank);
  const now = analyzeHand(hand, wildRank);
  if (trial.canDeclare) return true;
  if (trial.score + 8 <= now.score) return true;
  // same rank as something we already have (set bait)
  const sameRank = hand.filter((c) => !isJoker(c, wildRank) && c.rank === open.rank).length;
  if (sameRank >= 1 && !isJoker(open, wildRank)) return true;
  const sameSuitNear = hand.some((c) => {
    if (c.suit !== open.suit || isJoker(c, wildRank) || open.rank === "JOKER" || c.rank === "JOKER") {
      return false;
    }
    const a = rankGap(c, open);
    return a >= 1 && a <= 2;
  });
  return sameSuitNear;
}

function rankOrder(card: Card): number {
  const order = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  if (card.rank === "JOKER") return -1;
  return order.indexOf(card.rank);
}

function rankGap(a: Card, b: Card): number {
  return Math.abs(rankOrder(a) - rankOrder(b));
}

function chooseDiscard(hand14: Card[], wildRank: Rank | null, drawnId: string | null): string {
  let bestId = hand14[hand14.length - 1]!.id;
  let best = Infinity;
  for (const card of hand14) {
    if (isJoker(card, wildRank)) continue;
    const rest = hand14.filter((c) => c.id !== card.id);
    const a = analyzeHand(rest, wildRank);
    let score = a.score * 10 - a.sequenceCount * 6 - a.pureCount * 12;
    score += cardPoints(card, wildRank);
    // Prefer tossing the freshly drawn dead card so we don't churn
    if (drawnId && card.id === drawnId) score -= 2;
    if (score < best) {
      best = score;
      bestId = card.id;
    }
  }
  return bestId;
}

export function botShouldDrop(state: GameState): boolean {
  const seat = currentSeat(state);
  if (seat.hasDrawnThisHand) return false;
  const cards = getSeatCards(state, seat.id);
  const a = analyzeHand(cards, state.wildRank);
  // First-turn drop if the hand is a wreck and we sit at a points table.
  if (state.table.variant === "points" && !seat.hasDrawnThisHand && a.score >= 70 && a.pureCount === 0) {
    const rng = createRng(state.seed + state.handNumber * 31 + state.turn + state.logSeq);
    return rng.next() < 0.12;
  }
  return false;
}

export function takeBotTurn(state: GameState): GameState {
  const seat = currentSeat(state);
  if (!seat.isBot || seat.status !== "active") return state;

  if (state.phase === "draw") {
    if (botShouldDrop(state)) return drop(state, seat.id);
    const hand = getSeatCards(state, seat.id);
    const open = openTop(state);
    const pickOpen = open && usefulOpenCard(hand, open, state.wildRank);
    return pickOpen ? drawOpen(state, seat.id) : drawClosed(state, seat.id);
  }

  if (state.phase === "discard") {
    let s = autoArrange(state, seat.id);
    const hand = getSeatCards(s, seat.id);
    const discardId = chooseDiscard(hand, s.wildRank, s.drawnCardId);
    const rest = hand.filter((c) => c.id !== discardId);
    const a = analyzeHand(rest, s.wildRank);
    if (a.canDeclare) return declare(s, seat.id, discardId);
    return discard(s, seat.id, discardId);
  }

  return state;
}

export function peekCardLabel(state: GameState, id: string): string {
  const c = lookupCard(state, id);
  return c ? `${c.rank}${c.suit}` : id;
}
