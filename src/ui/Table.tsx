import { useEffect, useMemo, useRef, useState } from "react";
import { takeBotTurn } from "../game/bots";
import { isJoker } from "../game/cards";
import {
  autoArrange,
  currentSeat,
  declare,
  discard,
  drawClosed,
  drawOpen,
  drop,
  getSeatCards,
  groupSelected,
  lookupCard,
  moveCard,
  nextHand,
  openTop,
  rematch,
  sortHand,
  splitGroup,
} from "../game/engine";
import { formatChips, variantLabel } from "../game/lobby";
import { analyzeHand, evaluateGroups } from "../game/melds";
import { type GameState } from "../game/types";
import { CardBackStack, CardView } from "./CardView";

type Props = {
  game: GameState;
  youId: string;
  chips: number;
  onChange: (g: GameState) => void;
  onCashout: (delta: number) => void;
  onLeave: () => void;
  onHowTo: () => void;
};

export function Table({ game, youId, chips, onChange, onCashout, onLeave, onHowTo }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmInvalid, setConfirmInvalid] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(20);
  const gameRef = useRef(game);
  gameRef.current = game;

  const you = game.seats.find((s) => s.id === youId)!;
  const turnSeat = currentSeat(game);
  const yourTurn = turnSeat.id === youId && (game.phase === "draw" || game.phase === "discard");
  const handCount = you.groups.reduce((n, g) => n + g.length, 0);
  const wild = game.wildRank;
  const open = openTop(game);

  const youCards = useMemo(() => getSeatCards(game, youId), [game, youId]);
  const analysis = useMemo(() => analyzeHand(youCards, wild), [youCards, wild]);

  useEffect(() => {
    setSelected([]);
  }, [game.logSeq, game.phase, game.turn]);

  useEffect(() => {
    if (game.phase !== "draw" && game.phase !== "discard") return;
    if (!turnSeat.isBot || turnSeat.status !== "active") return;
    const wait = game.phase === "draw" ? 850 : 650;
    const t = window.setTimeout(() => onChange(takeBotTurn(game)), wait);
    return () => window.clearTimeout(t);
  }, [game, onChange, turnSeat.isBot, turnSeat.status]);

  useEffect(() => {
    if (!yourTurn) return;
    setSeconds(20);
    const turnToken = game.logSeq;
    const tick = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    const auto = window.setTimeout(() => {
      const current = gameRef.current;
      if (current.logSeq !== turnToken) return;
      const seat = currentSeat(current);
      if (seat.id !== youId) return;
      if (current.phase === "draw") onChange(drawClosed(current, youId));
      else if (current.phase === "discard") {
        const cards = getSeatCards(current, youId);
        const id = current.drawnCardId ?? cards[cards.length - 1]?.id;
        if (id) onChange(discard(current, youId, id));
      }
    }, 20000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(auto);
    };
  }, [yourTurn, game.logSeq, onChange, youId]);

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(null), 2400);
  }

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function onDrawClosed() {
    if (!yourTurn || game.phase !== "draw") return flash("Wait for your draw.");
    onChange(drawClosed(game, youId));
  }

  function onDrawOpen() {
    if (!yourTurn || game.phase !== "draw") return flash("Wait for your draw.");
    if (!open) return;
    onChange(drawOpen(game, youId));
  }

  function onDiscard() {
    if (!yourTurn || game.phase !== "discard") return flash("Pick a card first.");
    if (selected.length !== 1) return flash("Select exactly one card to discard.");
    onChange(discard(game, youId, selected[0]!));
  }

  function onDrop() {
    if (!yourTurn || game.phase !== "draw") return flash("Drop before you pick.");
    onChange(drop(game, youId));
  }

  function tryFinish() {
    if (!yourTurn || game.phase !== "discard") return flash("Draw, then finish with a discard.");
    if (selected.length !== 1) return flash("Select the card you want to throw as finish.");
    const discardId = selected[0]!;
    const remaining = you.groups
      .map((g) => g.filter((id) => id !== discardId))
      .filter((g) => g.length);
    const grouped = remaining.map((g) => g.map((id) => lookupCard(game, id)!).filter(Boolean));
    const groupedEval = evaluateGroups(grouped, wild);
    const restCards = grouped.flat();
    const auto = analyzeHand(restCards, wild);
    if (groupedEval.validDeclare || auto.canDeclare) {
      onChange(declare(game, youId, discardId));
      return;
    }
    setConfirmInvalid(discardId);
  }

  function settleAndLeave() {
    const delta = game.seats.find((s) => s.id === youId)?.chipsDelta ?? 0;
    onCashout(delta);
    onLeave();
  }

  function settleAndRematch() {
    const delta = game.seats.find((s) => s.id === youId)?.chipsDelta ?? 0;
    const fee = game.table.entryFee || 0;
    if (chips + delta - fee < 0) {
      onCashout(delta);
      onLeave();
      return;
    }
    onCashout(delta - fee);
    onChange(rematch(game));
  }

  function settleAndNext() {
    const delta = game.seats.find((s) => s.id === youId)?.chipsDelta ?? 0;
    onCashout(delta);
    onChange(nextHand(game));
  }

  const others = game.seats.filter((s) => s.id !== youId);
  const showing = game.phase === "show" || game.phase === "matchOver";

  return (
    <div className="table-page">
      <header className="topbar tablebar">
        <button type="button" className="btn ghost" onClick={settleAndLeave}>
          Lobby
        </button>
        <div className="match-meta">
          <strong>{variantLabel(game.table.variant)}</strong>
          <span>
            Hand {game.handNumber}
            {game.table.deals ? ` / ${game.table.deals}` : ""}
          </span>
          {game.table.variant === "points" && <span>₹{game.table.pointValue} / pt</span>}
        </div>
        <div className="topbar-right">
          <button type="button" className="linkish" onClick={onHowTo}>
            Rules
          </button>
          <div className="chip-pill">
            <span>Chips</span>
            <b>{formatChips(chips)}</b>
          </div>
        </div>
      </header>

      <div className="felt">
        <div className={`opponents n${others.length}`}>
          {others.map((seat) => (
            <div
              key={seat.id}
              className={`opp ${seat.id === turnSeat.id ? "active" : ""} ${seat.status}`}
            >
              <div className="avatar" style={{ background: `hsl(${seat.avatarHue} 70% 42%)` }}>
                {seat.name.slice(0, 1)}
              </div>
              <div className="opp-meta">
                <b>{seat.name}</b>
                <span>
                  {seat.status === "dropped"
                    ? "Dropped"
                    : seat.status === "eliminated"
                      ? "Out"
                      : `${seat.groups.reduce((n, g) => n + g.length, 0)} cards`}
                </span>
                {(game.table.variant !== "points" || seat.matchPoints > 0) && (
                  <em>{seat.matchPoints} pts</em>
                )}
              </div>
              <div className="opp-fan" aria-hidden>
                {Array.from({ length: Math.min(6, seat.groups.reduce((n, g) => n + g.length, 0) ? 6 : 0) }).map(
                  (_, i) => (
                    <span key={i} className="mini-back" style={{ transform: `rotate(${(i - 2.5) * 7}deg)` }} />
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="felt-center">
          <div className="joker-well">
            {game.wildCard && (
              <CardView card={game.wildCard} wildRank={wild} compact dimmed />
            )}
            <span>Wild {wild ?? ""}</span>
          </div>
          <CardBackStack count={game.closed.length} label="Closed" onClick={yourTurn && game.phase === "draw" ? onDrawClosed : undefined} />
          <button
            type="button"
            className="open-well"
            onClick={yourTurn && game.phase === "draw" ? onDrawOpen : undefined}
          >
            {open ? (
              <CardView card={open} wildRank={wild} />
            ) : (
              <span className="empty-open">Open</span>
            )}
            <span className="stack-label">Open</span>
          </button>
        </div>

        <div className="turn-banner">
          {showing ? (
            <span>Hand over</span>
          ) : yourTurn ? (
            <span className="you-go">
              Your turn · {game.phase === "draw" ? "pick a card" : "discard or finish"} · {seconds}s
            </span>
          ) : (
            <span>{turnSeat.name} is playing…</span>
          )}
        </div>
      </div>

      <section className="rack">
        <div className="rack-head">
          <div className="you-chip">
            <div className="avatar" style={{ background: `hsl(${you.avatarHue} 70% 42%)` }}>
              {you.name.slice(0, 1)}
            </div>
            <div>
              <b>{you.name}</b>
              <span>
                {handCount} cards · deadwood {analysis.score}
                {analysis.hasLife ? " · life made" : ""}
              </span>
            </div>
          </div>
          <div className="hint">
            Select cards to group. Need 2 sequences, including 1 pure, to declare.
          </div>
        </div>
        <div className="groups">
          {you.groups.map((group, gi) => {
            const cards = group.map((id) => lookupCard(game, id)!).filter(Boolean);
            const jokers = cards.filter((c) => isJoker(c, wild)).length;
            return (
              <div key={`${gi}-${group.join()}`} className="group">
                {cards.map((card) => (
                  <CardView
                    key={card.id}
                    card={card}
                    wildRank={wild}
                    selected={selected.includes(card.id)}
                    onClick={() => toggle(card.id)}
                    onDoubleClick={() => onChange(splitGroup(game, youId, gi))}
                  />
                ))}
                {group.length > 1 && (
                  <button
                    type="button"
                    className="split"
                    onClick={() => onChange(splitGroup(game, youId, gi))}
                  >
                    Split{jokers ? ` · ${jokers}J` : ""}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={() => onChange(sortHand(game, youId))}>
            Sort
          </button>
          <button type="button" className="btn ghost" onClick={() => onChange(autoArrange(game, youId))}>
            Arrange
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={selected.length < 2}
            onClick={() => onChange(groupSelected(game, youId, selected))}
          >
            Group
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={selected.length !== 1}
            onClick={() => onChange(moveCard(game, youId, selected[0]!, "new"))}
          >
            Ungroup
          </button>
          <span className="flex-space" />
          <button
            type="button"
            className="btn warn"
            disabled={!yourTurn || game.phase !== "draw"}
            onClick={onDrop}
          >
            Drop
          </button>
          <button
            type="button"
            className="btn"
            disabled={!yourTurn || game.phase !== "discard" || selected.length !== 1}
            onClick={onDiscard}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn gold"
            disabled={!yourTurn || game.phase !== "discard" || selected.length !== 1 || handCount !== 14}
            onClick={tryFinish}
          >
            Finish
          </button>
        </div>
      </section>

      <aside className="log" aria-label="Hand log">
        {game.log.slice(-8).map((e) => (
          <p key={e.id}>{e.text}</p>
        ))}
      </aside>

      {toast && <div className="toast">{toast}</div>}

      {confirmInvalid && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal">
            <h2>Invalid declaration</h2>
            <p>
              This hand is not ready (need two sequences including one pure, covering all 13
              cards). Declaring anyway costs 80 points.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setConfirmInvalid(null)}>
                Keep playing
              </button>
              <button
                type="button"
                className="btn warn"
                onClick={() => {
                  onChange(declare(game, youId, confirmInvalid));
                  setConfirmInvalid(null);
                }}
              >
                Declare anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {showing && game.show && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal score-modal">
            <p className="eyebrow">
              {game.phase === "matchOver" ? "Match over" : "Show"}
            </p>
            <h2>
              {game.show.reason === "invalid"
                ? "Wrong declare"
                : game.show.reason === "drop" || game.show.reason === "lastStanding"
                  ? "Table folded"
                  : game.show.winnerId === youId
                    ? "You win the hand"
                    : `${game.seats.find((s) => s.id === game.show?.winnerId)?.name ?? "Winner"} declared`}
            </h2>
            <table className="score-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pts</th>
                  <th>Chips</th>
                </tr>
              </thead>
              <tbody>
                {game.seats.map((s) => (
                  <tr key={s.id} className={s.id === game.show?.winnerId ? "win" : ""}>
                    <td>{s.name}</td>
                    <td>{s.lastHandPoints}</td>
                    <td>
                      {s.chipsDelta > 0 ? "+" : ""}
                      {formatChips(s.chipsDelta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={settleAndLeave}>
                Lobby
              </button>
              {game.phase === "show" && game.table.variant !== "points" ? (
                <button type="button" className="btn gold" onClick={settleAndNext}>
                  Next hand
                </button>
              ) : (
                <button type="button" className="btn gold" onClick={settleAndRematch}>
                  Rematch
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
