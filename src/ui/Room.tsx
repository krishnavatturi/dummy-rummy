import type { RoomView } from "../net/client";
import { formatChips, variantLabel } from "../game/lobby";

type Props = {
  room: RoomView;
  error: string | null;
  onStart: (fillBots: boolean) => void;
  onLeave: () => void;
};

export function Room({ room, error, onStart, onLeave }: Props) {
  const host = room.players.find((p) => p.id === room.hostId);
  const youHost = room.youId === room.hostId;
  const empty = Math.max(0, room.table.seats - room.players.length);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="lobby">
      <header className="topbar">
        <button type="button" className="brand-lockup" onClick={onLeave}>
          <span className="brand-mark">Adda</span>
          <span className="brand-sub">Rummy</span>
        </button>
        <button type="button" className="btn ghost" onClick={onLeave}>
          Leave table
        </button>
      </header>

      <section className="room-hero">
        <p className="eyebrow">Online adda · {variantLabel(room.table.variant)}</p>
        <h1>Table {room.code}</h1>
        <p className="lede">
          Share this code with the other player. Host deals when you’re ready. Empty
          seats can be filled with bots.
        </p>
        <button type="button" className="room-code" onClick={copyCode}>
          {room.code}
          <span>click to copy</span>
        </button>
        {error && <p className="error-line">{error}</p>}
      </section>

      <section className="lobby-section">
        <header>
          <h2>
            Seats {room.players.length}/{room.table.seats}
          </h2>
          <p>
            {room.table.name}
            {room.table.entryFee > 0 ? ` · entry ${formatChips(room.table.entryFee)}` : ""}
          </p>
        </header>
        <ul className="seat-list">
          {room.players.map((p) => (
            <li key={p.id}>
              <span className="avatar" style={{ background: `hsl(${p.avatarHue} 70% 42%)` }}>
                {p.name.slice(0, 1)}
              </span>
              <b>{p.name}</b>
              {p.id === room.hostId && <em>host</em>}
              {p.id === room.youId && <em>you</em>}
            </li>
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <li key={`empty-${i}`} className="empty">
              <span className="avatar">?</span>
              <b>Waiting…</b>
            </li>
          ))}
        </ul>
        {youHost ? (
          <div className="actions">
            <button
              type="button"
              className="btn gold"
              disabled={room.players.length < 1}
              onClick={() => onStart(true)}
            >
              Deal · fill empty seats with bots
            </button>
            <button
              type="button"
              className="btn"
              disabled={room.players.length < 2}
              onClick={() => onStart(false)}
            >
              Deal · humans only
            </button>
          </div>
        ) : (
          <p className="lede">Waiting for {host?.name ?? "the host"} to deal.</p>
        )}
      </section>
    </div>
  );
}