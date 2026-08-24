type Props = { onClose: () => void };

export function HowToPlay({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal how-to" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>How to play Indian Rummy</h2>
          <button type="button" className="icon-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            This is a practice table for 13-card Indian rummy — the same family of
            rules used on Adda-style apps. No real money. Chips are just score.
          </p>
          <ol>
            <li>Each player is dealt 13 cards from two packs plus printed jokers.</li>
            <li>
              A wild joker is flipped. Every card of that rank, and printed jokers,
              can stand in for any missing card.
            </li>
            <li>On your turn pick one card from the closed deck or the open pile, then discard one.</li>
            <li>
              Declare when your 13 cards are all grouped into valid sequences and
              sets, including <b>at least two sequences</b>, one of which must be a{" "}
              <b>pure sequence</b> (no jokers).
            </li>
            <li>
              A sequence is 3+ consecutive cards of the same suit (A-2-3 or Q-K-A).
              A set is 3 or 4 cards of the same rank.
            </li>
          </ol>
          <h3>Scoring</h3>
          <ul>
            <li>Number cards are face value. A, J, Q, K are 10. Jokers are 0.</li>
            <li>First drop: 20 · Middle drop: 40 · Wrong declare: 80 · Hand cap: 80.</li>
            <li>
              <b>Points</b> — winner collects opponents’ points × table value.
            </li>
            <li>
              <b>101 / 201 Pool</b> — accumulate points; hit the cap and you are out.
            </li>
            <li>
              <b>Deals</b> — play a fixed number of hands; lowest total wins the pot.
            </li>
          </ul>
        </div>
        <button type="button" className="btn gold" onClick={onClose}>
          Got it — let’s play
        </button>
      </div>
    </div>
  );
}
