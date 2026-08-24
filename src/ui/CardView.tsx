import { displayRank, isJoker, isRed } from "../game/cards";
import { suitSymbol } from "../game/types";
import type { Card, Rank } from "../game/types";

type Props = {
  card: Card;
  wildRank: Rank | null;
  selected?: boolean;
  faceDown?: boolean;
  compact?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
};

export function CardView({
  card,
  wildRank,
  selected,
  faceDown,
  compact,
  dimmed,
  onClick,
  onDoubleClick,
}: Props) {
  if (faceDown) {
    return (
      <button type="button" className={`playing-card back ${compact ? "compact" : ""}`} onClick={onClick}>
        <span className="back-diamond">♦</span>
      </button>
    );
  }

  const joker = isJoker(card, wildRank);
  const red = isRed(card.suit);
  const printed = card.rank === "JOKER";

  return (
    <button
      type="button"
      className={[
        "playing-card",
        red ? "red" : "black",
        joker ? "joker-card" : "",
        selected ? "selected" : "",
        compact ? "compact" : "",
        dimmed ? "dimmed" : "",
      ].join(" ")}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      aria-label={`${card.rank} ${card.suit}`}
    >
      {printed ? (
        <>
          <span className="corner tl">★</span>
          <span className="pip joker-pip">JOKER</span>
          <span className="corner br">★</span>
        </>
      ) : (
        <>
          <span className="corner tl">
            <b>{displayRank(card)}</b>
            <i>{suitSymbol(card.suit)}</i>
          </span>
          <span className="pip">{suitSymbol(card.suit)}</span>
          <span className="corner br">
            <b>{displayRank(card)}</b>
            <i>{suitSymbol(card.suit)}</i>
          </span>
          {joker && <span className="wild-ribbon">JOKER</span>}
        </>
      )}
    </button>
  );
}

export function CardBackStack({ count, label, onClick }: { count: number; label?: string; onClick?: () => void }) {
  return (
    <button type="button" className="stack-btn" onClick={onClick} disabled={!onClick}>
      <span className="stack">
        <span className="playing-card back stack-a" />
        <span className="playing-card back stack-b" />
        <span className="playing-card back stack-c" />
      </span>
      {label && <span className="stack-label">{label}</span>}
      <span className="stack-count">{count}</span>
    </button>
  );
}
