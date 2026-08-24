import { describe, expect, it } from "vitest";
import { buildShoe, cardPoints, createRng, isJoker } from "./cards";
import {
  analyzeHand,
  evaluateGroups,
  FIRST_DROP,
  isPureSequence,
  isSequence,
  isSet,
  MIDDLE_DROP,
} from "./melds";
import { createMatch, declare, discard, drawClosed, drawOpen, drop, getSeatCards } from "./engine";
import { takeBotTurn } from "./bots";
import type { Card, Rank, Suit, TableConfig } from "./types";

function C(rank: Rank | "JOKER", suit: Suit | "J", pack: 0 | 1 = 0): Card {
  return { id: `${pack}-${suit}-${rank}-${Math.random()}`, suit, rank, pack };
}

describe("sequences and sets", () => {
  it("accepts a pure A-2-3", () => {
    const cards = [C("A", "H"), C("2", "H"), C("3", "H")];
    expect(isPureSequence(cards, "K")).toBe(true);
  });

  it("accepts Q-K-A as ace-high", () => {
    const cards = [C("Q", "S"), C("K", "S"), C("A", "S")];
    expect(isPureSequence(cards, "2")).toBe(true);
  });

  it("rejects wrapping K-A-2", () => {
    const cards = [C("K", "S"), C("A", "S"), C("2", "S")];
    expect(isSequence(cards, "7", false)).toBe(false);
  });

  it("allows a joker to fill a gap as an impure run", () => {
    const joker = C("JOKER", "J");
    const cards = [C("5", "D"), joker, C("7", "D")];
    expect(isSequence(cards, "K", false)).toBe(true);
    expect(isPureSequence(cards, "K")).toBe(false);
  });

  it("treats the wild rank as a joker", () => {
    const wild = C("4", "C");
    expect(isJoker(wild, "4")).toBe(true);
    expect(cardPoints(wild, "4")).toBe(0);
    const cards = [C("9", "H"), wild, C("J", "H")];
    expect(isSequence(cards, "4", false)).toBe(true);
  });

  it("accepts a set of three ranks", () => {
    expect(isSet([C("7", "S"), C("7", "H"), C("7", "D")], "K")).toBe(true);
  });

  it("rejects a two-card group", () => {
    expect(isSet([C("7", "S"), C("7", "H")], "K")).toBe(false);
    expect(isSequence([C("7", "S"), C("8", "S")], "K", false)).toBe(false);
  });
});

describe("hand analysis", () => {
  it("scores a ready declare as 0", () => {
    const wild: Rank = "2";
    const ready = [
      C("4", "H"),
      C("5", "H"),
      C("6", "H"),
      C("5", "S"),
      C("6", "S"),
      C("7", "S"),
      C("9", "D"),
      C("9", "C"),
      C("9", "H"),
      C("J", "C"),
      C("Q", "C"),
      C("K", "C"),
      C("A", "C"),
    ];
    const a = analyzeHand(ready, wild);
    expect(a.canDeclare).toBe(true);
    expect(a.score).toBe(0);
    expect(a.hasLife).toBe(true);
  });

  it("caps deadwood at 80", () => {
    const high = [
      C("K", "S"),
      C("K", "H"),
      C("Q", "D"),
      C("Q", "C"),
      C("J", "S"),
      C("J", "H"),
      C("10", "D"),
      C("10", "C"),
      C("A", "S"),
      C("A", "H"),
      C("9", "D"),
      C("8", "C"),
      C("7", "S"),
    ];
    expect(analyzeHand(high, "2").score).toBe(80);
  });

  it("does not count sets without a second sequence", () => {
    const cards = [
      C("4", "H"),
      C("5", "H"),
      C("6", "H"),
      C("9", "S"),
      C("9", "H"),
      C("9", "D"),
      C("K", "S"),
      C("Q", "H"),
      C("J", "D"),
      C("8", "C"),
      C("3", "C"),
      C("7", "S"),
      C("A", "D"),
    ];
    const grouped = [
      [cards[0]!, cards[1]!, cards[2]!],
      [cards[3]!, cards[4]!, cards[5]!],
      cards.slice(6),
    ];
    const ev = evaluateGroups(grouped, "2");
    expect(ev.validDeclare).toBe(false);
    expect(ev.score).toBeGreaterThan(0);
  });
});

const points2: TableConfig = {
  id: "t",
  name: "test",
  variant: "points",
  seats: 2,
  pointValue: 1,
  entryFee: 0,
};

describe("engine", () => {
  it("deals 13 cards and a wild joker", () => {
    const game = createMatch(
      points2,
      [
        { id: "you", name: "You", isBot: false, avatarHue: 1 },
        { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
      ],
      42,
    );
    expect(game.phase).toBe("draw");
    expect(game.wildRank).toBeTruthy();
    expect(getSeatCards(game, "you")).toHaveLength(13);
    expect(getSeatCards(game, "bot")).toHaveLength(13);
    expect(game.open).toHaveLength(1);
  });

  it("first drop is 20 points", () => {
    let game = createMatch(
      points2,
      [
        { id: "you", name: "You", isBot: false, avatarHue: 1 },
        { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
      ],
      7,
    );
    const actor = game.seats[game.turn]!.id;
    game = drop(game, actor);
    expect(game.phase).toBe("show");
    expect(game.show?.scores.find((s) => s.id === actor)?.points).toBe(FIRST_DROP);
  });

  it("middle drop is 40 after a pick", () => {
    let game = createMatch(
      points2,
      [
        { id: "you", name: "You", isBot: false, avatarHue: 1 },
        { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
      ],
      99,
    );
    const a = game.seats[game.turn]!.id;
    game = drawClosed(game, a);
    const card = getSeatCards(game, a)[0]!;
    game = discard(game, a, card.id);
    const b = game.seats[game.turn]!.id;
    game = drawClosed(game, b);
    const cardB = getSeatCards(game, b)[0]!;
    game = discard(game, b, cardB.id);
    const again = game.seats[game.turn]!.id;
    expect(again).toBe(a);
    game = drop(game, a);
    expect(game.show?.scores.find((s) => s.id === a)?.points).toBe(MIDDLE_DROP);
  });

  it("draw from open takes the face-up card", () => {
    let game = createMatch(
      points2,
      [
        { id: "you", name: "You", isBot: false, avatarHue: 1 },
        { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
      ],
      3,
    );
    const actor = game.seats[game.turn]!.id;
    const top = game.open[0]!;
    game = drawOpen(game, actor);
    expect(getSeatCards(game, actor).some((c) => c.id === top.id)).toBe(true);
    expect(getSeatCards(game, actor)).toHaveLength(14);
  });

  it("invalid declare awards 80", () => {
    let game = createMatch(
      points2,
      [
        { id: "you", name: "You", isBot: false, avatarHue: 1 },
        { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
      ],
      11,
    );
    const actor = game.seats[game.turn]!.id;
    game = drawClosed(game, actor);
    const extra = getSeatCards(game, actor)[0]!;
    game = declare(game, actor, extra.id);
    expect(game.phase).toBe("show");
    expect(game.show?.reason).toBe("invalid");
    expect(game.show?.scores.find((s) => s.id === actor)?.points).toBe(80);
  });
});

describe("bot vs bot playthrough", () => {
  it("finishes a points hand without throwing", () => {
    const shoeSize = buildShoe().length;
    expect(shoeSize).toBe(106);

    let game = createMatch(
      points2,
      [
        { id: "a", name: "A", isBot: true, avatarHue: 1 },
        { id: "b", name: "B", isBot: true, avatarHue: 2 },
      ],
      2026,
    );
    let steps = 0;
    while (game.phase !== "show" && game.phase !== "matchOver" && steps < 400) {
      game = takeBotTurn(game);
      steps++;
    }
    expect(["show", "matchOver"]).toContain(game.phase);
    expect(game.show).toBeTruthy();
    expect(createRng(1).shuffle([1, 2, 3])).toHaveLength(3);
  });
});
