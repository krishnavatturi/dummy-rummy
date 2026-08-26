import { useEffect, useMemo, useState } from "react";
import type { RoomView } from "../net/client";
import { formatChips, variantLabel } from "../game/lobby";
import {
  bestInviteOrigin,
  inviteHint,
  makeInviteLink,
  type HostInfo,
} from "../net/invite";

type Props = {
  room: RoomView;
  error: string | null;
  onStart: (fillBots: boolean) => void;
  onLeave: () => void;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function Room({ room, error, onStart, onLeave }: Props) {
  const host = room.players.find((p) => p.id === room.hostId);
  const youHost = room.youId === room.hostId;
  const empty = Math.max(0, room.table.seats - room.players.length);
  const [info, setInfo] = useState<HostInfo | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/info");
        if (!res.ok || stop) return;
        setInfo((await res.json()) as HostInfo);
      } catch {
        /* ignore */
      }
    }
    void tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  const origin = bestInviteOrigin(location.origin, info);
  const inviteUrl = useMemo(() => makeInviteLink(origin, room.code), [origin, room.code]);
  const hint = inviteHint(origin, info);

  async function copy(kind: "code" | "link") {
    const ok = await copyText(kind === "code" ? room.code : inviteUrl);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Adda rummy · ${room.code}`,
        text: `Sit at table ${room.code} — practice Indian rummy, no cash.`,
        url: inviteUrl,
      });
    } catch {
      await copy("link");
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
        <p className="lede">Send this link. Friends open it, type a name, and sit. Empty seats can be filled with bots.</p>
        <button type="button" className="room-code" onClick={() => copy("code")}>
          {room.code}
          <span>{copied === "code" ? "copied" : "click to copy code"}</span>
        </button>
        <div className="invite-box">
          <label>
            Invite link
            <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="invite-actions">
            <button type="button" className="btn gold" onClick={() => copy("link")}>
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
            {canShare && (
              <button type="button" className="btn" onClick={() => void share()}>
                Share
              </button>
            )}
          </div>
          <p className="invite-hint">{hint}</p>
        </div>
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
