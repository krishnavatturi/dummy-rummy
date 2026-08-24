import { displayRank, isJoker, isRed } from "../game/cards";
import { suitSymbol } from "../game/types";
import type { Card, Rank } from "../game/types";
import type { ReactNode } from "react";

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

function cardClass(p: {
  red: boolean;
  joker: boolean;
  selected?: boolean;
  compact?: boolean;
  dimmed?: boolean;
}): string {
  return [
    "playing-card",
    p.red ? "red" : "black",
    p.joker ? "joker-card" : "",
    p.selected ? "selected" : "",
    p.compact ? "compact" : "",
    p.dimmed ? "dimmed" : "",
  ].join(" ");
}

function Face({ card, wildRank }: { card: Card; wildRank: Rank | null }) {
  const joker = isJoker(card, wildRank);
  const printed = card.rank === "JOKER";
  if (printed) {
    return (
      <>
        <span className="corner tl">★</span>
        <span className="pip joker-pip">JOKER</span>
        <span className="corner br">★</span>
      </>
    );
  }
  return (
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
  );
}

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

  const className = cardClass({
    red: isRed(card.suit),
    joker: isJoker(card, wildRank),
    selected,
    compact,
    dimmed,
  });
  const face: ReactNode = <Face card={card} wildRank={wildRank} />;

  if (onClick || onDoubleClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        aria-label={`${card.rank} ${card.suit}`}
      >
        {face}
      </button>
    );
  }

  return (
    <div className={className} aria-label={`${card.rank} ${card.suit}`}>
      {face}
    </div>
  );
}

export function CardBackStack({ count, label, onClick }: { count: number; label?: string; onClick?: () => void }) {
  return (
    <button type="button" className={`stack-btn ${onClick ? "hot" : ""}`} onClick={onClick} disabled={!onClick}>
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
