type Props = {
  name: string;
  onName: (v: string) => void;
  onPlay: () => void;
  onHowTo: () => void;
  inviteCode?: string;
  error?: string | null;
};

export function Landing({ name, onName, onPlay, onHowTo, inviteCode, error }: Props) {
  const joining = Boolean(inviteCode);
  return (
    <div className="landing">
      <div className="landing-glow" />
      <header className="landing-top">
        <span className="brand-mark">Certified Uncles</span>
        <button type="button" className="linkish" onClick={onHowTo}>
          How to play
        </button>
      </header>
      <main className="landing-hero">
        <p className="eyebrow">13-card · Points · Pool · Deals</p>
        <h1 className="logo-word">
          ADDA
          <span>RUMMY</span>
        </h1>
        <p className="tagline">
          Indian rummy adda — practice chips, real sequences, no cash tables.
        </p>
        {joining && (
          <p className="invite-banner">
            You’re invited to table <b>{inviteCode}</b>. Enter a name, then sit. No git needed.
          </p>
        )}
        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            onPlay();
          }}
        >
          <label>
            Table name
            <input
              value={name}
              maxLength={16}
              placeholder="Your name"
              onChange={(e) => onName(e.target.value)}
            />
          </label>
          <button type="submit" className="btn gold xl">
            {joining ? `Join table ${inviteCode}` : "Play now"}
          </button>
        </form>
        {error && <p className="error-line">{error}</p>}
        <ul className="pill-row">
          <li>2–6 players</li>
          <li>Wild + printed jokers</li>
          <li>1,00,000 practice chips</li>
        </ul>
      </main>
    </div>
  );
}
