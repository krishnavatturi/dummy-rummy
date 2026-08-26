import { analyzeHand, DECLARE_PENALTY, evaluateGroups, FIRST_DROP, MIDDLE_DROP } from "./melds";
import { buildShoe, createRng, flattenGroups, isJoker, sortCards } from "./cards";
import type {
  Card,
  GameState,
  Group,
  LogEvent,
  Rank,
  SeatState,
  ShowResult,
  TableConfig,
  TableSeat,
} from "./types";

function log(state: GameState, text: string): LogEvent {
  return { id: state.logSeq + 1, text };
}

function nextTurn(state: GameState, from: number): number {
  const n = state.seats.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (state.seats[idx]!.status === "active") return idx;
  }
  return from;
}

function activeSeats(state: GameState): SeatState[] {
  return state.seats.filter((s) => s.status === "active");
}

type Internal = GameState & { _cards: Map<string, Card> };

function asInternal(state: GameState): Internal {
  return state as Internal;
}

function removeCardFromGroups(groups: Group[], cardId: string): Group[] {
  return groups
    .map((g) => g.filter((id) => id !== cardId))
    .filter((g) => g.length > 0);
}

function addToHand(groups: Group[], cardId: string): Group[] {
  return [...groups, [cardId]];
}

function countHand(groups: Group[]): number {
  return groups.reduce((n, g) => n + g.length, 0);
}

function refillClosed(state: Internal): void {
  if (state.closed.length > 0) return;
  if (state.open.length <= 1) return;
  const top = state.open[state.open.length - 1]!;
  const rest = state.open.slice(0, -1);
  const rng = createRng(state.seed + state.handNumber * 997 + rest.length);
  state.closed = rng.shuffle(rest);
  state.open = [top];
}

function cloneState(state: GameState): Internal {
  const s = asInternal(state);
  return {
    ...s,
    closed: s.closed.slice(),
    open: s.open.slice(),
    log: s.log.slice(),
    seats: s.seats.map((seat) => ({
      ...seat,
      groups: seat.groups.map((g) => g.slice()),
    })),
    show: s.show
      ? {
          ...s.show,
          scores: s.show.scores.map((x) => ({ ...x })),
        }
      : null,
    table: { ...s.table },
    _cards: s._cards,
  };
}

export function dealHand(state: GameState): GameState {
  const s = cloneState(state);
  const rng = createRng(s.seed + s.handNumber * 104729);
  const shoe = rng.shuffle(buildShoe());
  s._cards = new Map(shoe.map((c) => [c.id, c]));

  const per = 13;
  let i = 0;
  for (const seat of s.seats) {
    if (seat.status === "eliminated") continue;
    const dealt = shoe.slice(i, i + per);
    i += per;
    seat.groups = sortCards(dealt, null).map((c) => [c.id]);
    seat.status = "active";
    seat.hasDrawnThisHand = false;
    seat.lastHandPoints = 0;
    seat.chipsDelta = 0;
  }

  const wildCard = shoe[i++]!;
  s.wildCard = wildCard;
  s.wildRank = wildCard.rank === "JOKER" ? "2" : (wildCard.rank as Rank);

  const open = shoe[i++]!;
  s.open = [open];
  s.closed = shoe.slice(i);
  s.drawnCardId = null;
  s.show = null;
  s.phase = "draw";
  s.turn = nextTurn(s, s.dealerIndex);
  s.winnerId = null;
  const ev = log(s, `Hand ${s.handNumber} dealt. Wild joker: ${labelCard(wildCard, s.wildRank)}.`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);
  return s;
}

function labelCard(card: Card, wildRank: Rank | null): string {
  if (card.rank === "JOKER") return "Printed Joker";
  const names: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const tag = isJoker(card, wildRank) ? " (joker)" : "";
  return `${card.rank}${names[card.suit] ?? ""}${tag}`;
}

export function createMatch(table: TableConfig, seats: TableSeat[], seed = Date.now()): GameState {
  const pot =
    table.variant === "points"
      ? 0
      : table.entryFee * seats.length;

  const state: Internal = {
    table,
    seed,
    handNumber: 1,
    dealerIndex: 0,
    turn: 0,
    phase: "idle",
    wildRank: null,
    wildCard: null,
    closed: [],
    open: [],
    seats: seats.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      avatarHue: p.avatarHue,
      groups: [],
      status: "active",
      hasDrawnThisHand: false,
      matchPoints: 0,
      lastHandPoints: 0,
      chipsDelta: 0,
    })),
    drawnCardId: null,
    show: null,
    log: [],
    logSeq: 0,
    winnerId: null,
    pot,
    _cards: new Map(),
  };
  return dealHand(state);
}

export function currentSeat(state: GameState): SeatState {
  return state.seats[state.turn]!;
}

export function canDraw(state: GameState, seatId: string): boolean {
  return state.phase === "draw" && currentSeat(state).id === seatId && currentSeat(state).status === "active";
}

export function canDiscard(state: GameState, seatId: string): boolean {
  return state.phase === "discard" && currentSeat(state).id === seatId;
}

export function drawClosed(state: GameState, seatId: string): GameState {
  if (!canDraw(state, seatId)) return state;
  const s = cloneState(state);
  refillClosed(s);
  if (s.closed.length === 0) return state;
  const card = s.closed.pop()!;
  const seat = s.seats[s.turn]!;
  seat.groups = addToHand(seat.groups, card.id);
  seat.hasDrawnThisHand = true;
  s.drawnCardId = card.id;
  s.phase = "discard";
  const ev = log(s, `${seat.name} picked from closed deck.`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);
  return s;
}

export function drawOpen(state: GameState, seatId: string): GameState {
  if (!canDraw(state, seatId)) return state;
  if (state.open.length === 0) return state;
  const s = cloneState(state);
  const card = s.open.pop()!;
  const seat = s.seats[s.turn]!;
  seat.groups = addToHand(seat.groups, card.id);
  seat.hasDrawnThisHand = true;
  s.drawnCardId = card.id;
  s.phase = "discard";
  const ev = log(s, `${seat.name} picked ${labelCard(card, s.wildRank)} from open deck.`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);
  return s;
}

export function discard(state: GameState, seatId: string, cardId: string): GameState {
  if (!canDiscard(state, seatId)) return state;
  const s = cloneState(state);
  const seat = s.seats[s.turn]!;
  if (countHand(seat.groups) !== 14) return state;
  if (!seat.groups.some((g) => g.includes(cardId))) return state;
  seat.groups = removeCardFromGroups(seat.groups, cardId);
  s.open.push(s._cards.get(cardId)!);
  s.drawnCardId = null;
  s.phase = "draw";
  s.turn = nextTurn(s, s.turn);
  const ev = log(s, `${seat.name} discarded ${labelCard(s._cards.get(cardId)!, s.wildRank)}.`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);
  return s;
}

export function drop(state: GameState, seatId: string): GameState {
  if (!canDraw(state, seatId)) return state;
  const s = cloneState(state);
  const seat = s.seats[s.turn]!;
  const pts = seat.hasDrawnThisHand ? MIDDLE_DROP : FIRST_DROP;
  seat.status = "dropped";
  seat.lastHandPoints = pts;
  const ev = log(s, `${seat.name} dropped (${pts} pts).`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);

  const alive = activeSeats(s);
  if (alive.length <= 1) {
    return finishHand(s, {
      winnerId: alive[0]?.id ?? null,
      reason: "lastStanding",
      scores: s.seats.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.status === "dropped" ? p.lastHandPoints : 0,
        valid: true,
      })),
    });
  }

  s.turn = nextTurn(s, s.turn);
  s.phase = "draw";
  return s;
}

export function declare(state: GameState, seatId: string, discardId: string): GameState {
  if (!canDiscard(state, seatId)) return state;
  const s = cloneState(state);
  const seat = s.seats[s.turn]!;
  if (countHand(seat.groups) !== 14) return state;
  if (!seat.groups.some((g) => g.includes(discardId))) return state;

  const remainingGroups = removeCardFromGroups(seat.groups, discardId);
  const remainingCards = flattenGroups(remainingGroups, s._cards);
  const grouped = remainingGroups.map((g) => flattenGroups([g], s._cards));
  const groupedEval = evaluateGroups(grouped, s.wildRank);
  const auto = analyzeHand(remainingCards, s.wildRank);
  const valid = groupedEval.validDeclare || auto.canDeclare;

  seat.groups = remainingGroups;
  s.open.push(s._cards.get(discardId)!);
  s.drawnCardId = null;

  if (!valid) {
    seat.status = "declared";
    seat.lastHandPoints = DECLARE_PENALTY;
    const ev = log(s, `${seat.name} made an invalid declaration (80 pts).`);
    s.logSeq = ev.id;
    s.log = [...s.log, ev].slice(-40);
    return finishHand(s, {
      winnerId: null,
      reason: "invalid",
      scores: s.seats.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.id === seat.id ? DECLARE_PENALTY : 0,
        valid: p.id !== seat.id,
      })),
    });
  }

  seat.status = "declared";
  seat.lastHandPoints = 0;
  const scores = s.seats.map((p) => {
    if (p.id === seat.id) return { id: p.id, name: p.name, points: 0, valid: true };
    if (p.status === "dropped") {
      return { id: p.id, name: p.name, points: p.lastHandPoints, valid: true };
    }
    const cards = flattenGroups(p.groups, s._cards);
    const analysis = analyzeHand(cards, s.wildRank);
    return { id: p.id, name: p.name, points: analysis.score, valid: analysis.canDeclare };
  });
  const ev = log(s, `${seat.name} declared and won the hand.`);
  s.logSeq = ev.id;
  s.log = [...s.log, ev].slice(-40);
  return finishHand(s, { winnerId: seat.id, reason: "declare", scores });
}

function finishHand(state: Internal, show: ShowResult): GameState {
  state.show = show;
  state.phase = "show";
  for (const seat of state.seats) {
    const row = show.scores.find((x) => x.id === seat.id);
    if (row) seat.lastHandPoints = row.points;
  }

  const pv = state.table.pointValue;
  if (state.table.variant === "points") {
    const winner = show.winnerId ? state.seats.find((s) => s.id === show.winnerId) : null;
    if (winner) {
      let gain = 0;
      for (const seat of state.seats) {
        if (seat.id === winner.id) continue;
        const loss = seat.lastHandPoints * pv;
        seat.chipsDelta = -loss;
        gain += loss;
      }
      winner.chipsDelta = gain;
    } else {
      // invalid declare: declarer pays max to each other player
      const loser = state.seats.find((s) => s.lastHandPoints === DECLARE_PENALTY);
      if (loser) {
        const others = state.seats.filter((s) => s.id !== loser.id);
        const each = DECLARE_PENALTY * pv;
        loser.chipsDelta = -each * others.length;
        for (const o of others) o.chipsDelta = each;
      }
    }
    state.winnerId = show.winnerId;
    return state;
  }

  for (const seat of state.seats) {
    if (seat.status === "eliminated") continue;
    seat.matchPoints += seat.lastHandPoints;
  }

  if (state.table.variant === "pool101" || state.table.variant === "pool201") {
    const cap = state.table.variant === "pool101" ? 101 : 201;
    for (const seat of state.seats) {
      if (seat.matchPoints >= cap) seat.status = "eliminated";
    }
    const remaining = state.seats.filter((s) => s.status !== "eliminated");
    if (remaining.length <= 1) {
      state.phase = "matchOver";
      state.winnerId = remaining[0]?.id ?? show.winnerId;
      for (const seat of state.seats) {
        seat.chipsDelta = seat.id === state.winnerId ? state.pot : 0;
      }
    }
    return state;
  }

  // deals
  const totalDeals = state.table.deals ?? 2;
  if (state.handNumber >= totalDeals) {
    state.phase = "matchOver";
    const sorted = [...state.seats].sort((a, b) => a.matchPoints - b.matchPoints);
    state.winnerId = sorted[0]?.id ?? null;
    const winner = sorted[0];
    for (const seat of state.seats) {
      seat.chipsDelta = winner && seat.id === winner.id ? state.pot : 0;
    }
  }
  return state;
}

export function nextHand(state: GameState): GameState {
  if (state.phase !== "show") return state;
  if (state.table.variant === "points") return state;
  const s = cloneState(state);
  if (s.phase === "matchOver") return s;
  s.handNumber += 1;
  s.dealerIndex = (s.dealerIndex + 1) % s.seats.length;
  return dealHand(s);
}

export function rematch(state: GameState): GameState {
  const seats: TableSeat[] = state.seats.map((s) => ({
    id: s.id,
    name: s.name,
    isBot: s.isBot,
    avatarHue: s.avatarHue,
  }));
  return createMatch(state.table, seats, state.seed + 17);
}

export function moveCard(
  state: GameState,
  seatId: string,
  cardId: string,
  toGroupIndex: number | "new",
  beforeCardId?: string,
): GameState {
  const idx = state.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return state;
  const s = cloneState(state);
  const seat = s.seats[idx]!;
  const groups = seat.groups.map((g) => g.slice());
  let fromG = -1;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.includes(cardId)) {
      fromG = i;
      groups[i] = groups[i]!.filter((id) => id !== cardId);
      break;
    }
  }
  if (fromG < 0) return state;

  if (toGroupIndex === "new") {
    groups.push([cardId]);
  } else {
    const g = groups[toGroupIndex] ?? [];
    if (beforeCardId) {
      const at = g.indexOf(beforeCardId);
      if (at >= 0) g.splice(at, 0, cardId);
      else g.push(cardId);
    } else {
      g.push(cardId);
    }
    groups[toGroupIndex] = g;
  }
  seat.groups = groups.filter((g) => g.length > 0);
  return s;
}

export function groupSelected(state: GameState, seatId: string, cardIds: string[]): GameState {
  if (cardIds.length < 2) return state;
  const idx = state.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return state;
  const s = cloneState(state);
  const seat = s.seats[idx]!;
  const set = new Set(cardIds);
  const rest = seat.groups
    .map((g) => g.filter((id) => !set.has(id)))
    .filter((g) => g.length > 0);
  const grouped = cardIds.filter((id) => seat.groups.some((g) => g.includes(id)));
  if (grouped.length < 2) return state;
  seat.groups = [...rest, grouped];
  return s;
}

export function splitGroup(state: GameState, seatId: string, groupIndex: number): GameState {
  const idx = state.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return state;
  const s = cloneState(state);
  const seat = s.seats[idx]!;
  const g = seat.groups[groupIndex];
  if (!g || g.length <= 1) return state;
  const singles = g.map((id) => [id]);
  seat.groups = [...seat.groups.slice(0, groupIndex), ...singles, ...seat.groups.slice(groupIndex + 1)];
  return s;
}

export function sortHand(state: GameState, seatId: string): GameState {
  const idx = state.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return state;
  const s = cloneState(state);
  const seat = s.seats[idx]!;
  const cards = sortCards(flattenGroups(seat.groups, s._cards), s.wildRank);
  const suitGroups: Record<string, string[]> = { S: [], H: [], D: [], C: [], J: [] };
  for (const c of cards) {
    const key = isJoker(c, s.wildRank) ? "J" : c.suit;
    (suitGroups[key] ??= []).push(c.id);
  }
  seat.groups = Object.values(suitGroups).filter((g) => g.length > 0);
  return s;
}

export function autoArrange(state: GameState, seatId: string): GameState {
  const idx = state.seats.findIndex((s) => s.id === seatId);
  if (idx < 0) return state;
  const s = cloneState(state);
  const seat = s.seats[idx]!;
  const cards = flattenGroups(seat.groups, s._cards);
  const analysis = analyzeHand(cards, s.wildRank);
  const groups: Group[] = analysis.groups.map((g) => g.map((c) => c.id));
  if (analysis.leftover.length) groups.push(analysis.leftover.map((c) => c.id));
  if (groups.length === 0) return s;
  seat.groups = groups;
  return s;
}

export function getSeatCards(state: GameState, seatId: string): Card[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  return flattenGroups(seat.groups, asInternal(state)._cards);
}

export function lookupCard(state: GameState, id: string): Card | undefined {
  return asInternal(state)._cards.get(id);
}

export function openTop(state: GameState): Card | undefined {
  return state.open[state.open.length - 1];
}

export function attachCards(state: GameState, cards: Card[]): GameState {
  const s = state as Internal;
  const map = new Map<string, Card>();
  for (const c of cards) map.set(c.id, c);
  for (const c of s.open) map.set(c.id, c);
  if (s.wildCard) map.set(s.wildCard.id, s.wildCard);
  s._cards = map;
  return s;
}
