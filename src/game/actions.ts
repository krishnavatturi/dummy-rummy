import {
  autoArrange,
  declare,
  discard,
  drawClosed,
  drawOpen,
  drop,
  groupSelected,
  moveCard,
  nextHand,
  rematch,
  sortHand,
  splitGroup,
} from "./engine";
import type { GameState } from "./types";

export type GameAction =
  | { type: "drawClosed" }
  | { type: "drawOpen" }
  | { type: "discard"; cardId: string }
  | { type: "drop" }
  | { type: "declare"; cardId: string }
  | { type: "sortHand" }
  | { type: "autoArrange" }
  | { type: "groupSelected"; cardIds: string[] }
  | { type: "splitGroup"; groupIndex: number }
  | { type: "moveCard"; cardId: string; toGroupIndex: number | "new"; beforeCardId?: string }
  | { type: "nextHand" }
  | { type: "rematch" };

export function applyAction(state: GameState, playerId: string, action: GameAction): GameState {
  switch (action.type) {
    case "drawClosed":
      return drawClosed(state, playerId);
    case "drawOpen":
      return drawOpen(state, playerId);
    case "discard":
      return discard(state, playerId, action.cardId);
    case "drop":
      return drop(state, playerId);
    case "declare":
      return declare(state, playerId, action.cardId);
    case "sortHand":
      return sortHand(state, playerId);
    case "autoArrange":
      return autoArrange(state, playerId);
    case "groupSelected":
      return groupSelected(state, playerId, action.cardIds);
    case "splitGroup":
      return splitGroup(state, playerId, action.groupIndex);
    case "moveCard":
      return moveCard(state, playerId, action.cardId, action.toGroupIndex, action.beforeCardId);
    case "nextHand":
      return nextHand(state);
    case "rematch":
      return rematch(state);
  }
}