import { formatChips, LOBBY_TABLES, tableBlurb, variantLabel } from "../game/lobby";
import type { TableConfig } from "../game/types";

type Props = {
  name: string;
  chips: number;
  joinCode: string;
  onJoinCode: (v: string) => void;
  onSit: (table: TableConfig) => void;
  onCreateOnline: (tableId: string) => void;
  onJoinOnline: () => void;
  onlineError: string | null;
  onHowTo: () => void;
  onLeave: () => void;
};

export function Lobby({
  name,
  chips,
  joinCode,
  onJoinCode,
  onSit,
  onCreateOnline,
  onJoinOnline,
  onlineError,
  onHowTo,
  onLeave,
}: Props) {
  const groups = [
    { key: "points", title: "Points Rummy", copy: "Fast hands. Winner collects points × value." },
    { key: "pool", title: "Pool Rummy", copy: "Stay under 101 or 201. Last player takes the pot." },
    { key: "deals", title: "Deals Rummy", copy: "Fixed number of deals. Lowest score wins." },
  ] as const;

  const tablesFor = (key: string) =>
    LOBBY_TABLES.filter((t) => {
      if (key === "points") return t.variant === "points";
      if (key === "pool") return t.variant === "pool101" || t.variant === "pool201";
      return t.variant === "deals";
    });

  return (
    <div className="lobby">
      <header className="topbar">
        <button type="button" className="brand-lockup" onClick={onLeave}>
          <span className="brand-mark">Adda</span>
          <span className="brand-sub">Rummy</span>
        </button>
        <div className="topbar-right">
          <button type="button" className="linkish" onClick={onHowTo}>
            How to play
          </button>
          <div className="chip-pill" title="Practice chips">
            <span>Chips</span>
            <b>{formatChips(chips)}</b>
          </div>
          <div className="user-pill">{name}</div>
        </div>
      </header>

      <section className="lobby-hero">
        <div>
          <p className="eyebrow">Practice adda</p>
          <h1>Pick a table. Bots fill the seats.</h1>
          <p className="lede">
            Points for a quick hand, pool if you want a longer session, deals when you
            like a fixed number of shows. Same 13-card rules throughout. Open a second
            browser for a live opponent, or sit vs bots.
          </p>
        </div>
        <div className="hero-stat">
          <span>Welcome bonus</span>
          <strong>1,00,000</strong>
          <em>practice chips · never cash</em>
        </div>
      </section>

      <section className="lobby-section online-panel">
        <header>
          <h2>Online adda</h2>
          <p>Create a table code and deal against a friend on the same server.</p>
        </header>
        <div className="online-row">
          <label>
            Join code
            <input
              value={joinCode}
              maxLength={6}
              placeholder="ABCD"
              onChange={(e) => onJoinCode(e.target.value.toUpperCase())}
            />
          </label>
          <button type="button" className="btn gold" disabled={joinCode.trim().length < 4} onClick={onJoinOnline}>
            Join table
          </button>
        </div>
        {onlineError && <p className="error-line">{onlineError}</p>}
        <div className="table-grid">
          {LOBBY_TABLES.filter((t) => t.seats === 2).slice(0, 3).map((t) => (
            <article key={`on-${t.id}`} className="table-card">
              <div className="table-card-top">
                <span className="badge">Online · {variantLabel(t.variant)}</span>
                <span className="seats">{t.seats}P</span>
              </div>
              <h3>{t.name}</h3>
              <p>Host a live table. Share the 4-letter code.</p>
              <button type="button" className="btn gold" onClick={() => onCreateOnline(t.id)}>
                Create room
              </button>
            </article>
          ))}
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.key} className="lobby-section">
          <header>
            <h2>{g.title}</h2>
            <p>{g.copy}</p>
          </header>
          <div className="table-grid">
            {tablesFor(g.key).map((t) => (
              <article key={t.id} className="table-card">
                <div className="table-card-top">
                  <span className="badge">{variantLabel(t.variant)}</span>
                  <span className="seats">{t.seats}P</span>
                </div>
                <h3>{t.name}</h3>
                <p>{tableBlurb(t)}</p>
                <button
                  type="button"
                  className="btn gold"
                  disabled={t.entryFee > chips}
                  onClick={() => onSit(t)}
                >
                  {t.entryFee > 0 ? `Sit · ${formatChips(t.entryFee)}` : "Sit & play"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
