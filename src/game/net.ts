import { attachCards } from "./engine";
import type { Card, GameState, SeatState } from "./types";

export type WireGame = GameState & { cards: Card[]; closedCount: number };

function collect(ids: string[], bag: Map<string, Card>, into: Map<string, Card>) {
  for (const id of ids) {
    const c = bag.get(id);
    if (c) into.set(c.id, c);
  }
}

function cardMap(state: GameState): Map<string, Card> {
  return (state as GameState & { _cards?: Map<string, Card> })._cards ?? new Map();
}

/** Per-player snapshot: own hand + public table, opponents' cards hidden until show. */
export function viewFor(state: GameState, viewerId: string): WireGame {
  const reveal = state.phase === "show" || state.phase === "matchOver";
  const bag = cardMap(state);
  const visible = new Map<string, Card>();
  if (state.wildCard) visible.set(state.wildCard.id, state.wildCard);
  for (const c of state.open) visible.set(c.id, c);

  const seats: SeatState[] = state.seats.map((seat) => {
    const ids = seat.groups.flat();
    if (reveal || seat.id === viewerId) {
      collect(ids, bag, visible);
      return {
        ...seat,
        groups: seat.groups.map((g) => g.slice()),
      };
    }
    return {
      ...seat,
      groups: ids.length ? [ids.map((_, i) => `hidden-${seat.id}-${i}`)] : [],
    };
  });

  return {
    ...state,
    seats,
    closed: Array.from({ length: state.closed.length }, (_, i) => ({
      id: `closed-${i}`,
      suit: "S",
      rank: "A",
      pack: 0,
    })),
    closedCount: state.closed.length,
    drawnCardId: state.seats[state.turn]?.id === viewerId ? state.drawnCardId : null,
    cards: [...visible.values()],
  };
}

export function hydrateGame(wire: WireGame): GameState {
  const { cards, closedCount, ...rest } = wire;
  const state: GameState = {
    ...rest,
    closed:
      rest.closed.length > 0
        ? rest.closed
        : Array.from({ length: closedCount }, (_, i) => ({
            id: `closed-${i}`,
            suit: "S",
            rank: "A",
            pack: 0,
          })),
  };
  return attachCards(state, cards);
}

export function hiddenCardCount(seat: SeatState): number {
  return seat.groups.reduce((n, g) => n + g.length, 0);
}