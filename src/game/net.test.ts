import { describe, expect, it } from "vitest";
import { applyAction } from "./actions";
import { createMatch, drawClosed, getSeatCards } from "./engine";
import { hydrateGame, viewFor } from "./net";
import type { TableConfig } from "./types";

const points2: TableConfig = {
  id: "t",
  name: "test",
  variant: "points",
  seats: 2,
  pointValue: 1,
  entryFee: 0,
};

const seats = [
  { id: "you", name: "You", isBot: false, avatarHue: 1 },
  { id: "bot", name: "Bot", isBot: true, avatarHue: 2 },
];

describe("online snapshots", () => {
  it("hides the opponent hand until show", () => {
    const game = createMatch(points2, seats, 9);
    const view = viewFor(game, "you");
    const opp = view.seats.find((s) => s.id === "bot")!;
    const you = view.seats.find((s) => s.id === "you")!;
    expect(opp.groups.flat().every((id) => id.startsWith("hidden-"))).toBe(true);
    expect(you.groups.flat().length).toBe(13);
    const yourIds = new Set(you.groups.flat());
    expect(view.cards.every((c) => yourIds.has(c.id) || c.id === game.wildCard?.id || game.open.some((o) => o.id === c.id))).toBe(
      true,
    );
    const live = hydrateGame(view);
    expect(getSeatCards(live, "you")).toHaveLength(13);
  });

  it("applies a closed draw for the current player", () => {
    let game = createMatch(points2, seats, 3);
    const actor = game.seats[game.turn]!.id;
    game = applyAction(game, actor, { type: "drawClosed" });
    expect(getSeatCards(game, actor)).toHaveLength(14);
    const before = game;
    game = applyAction(game, actor === "you" ? "bot" : "you", { type: "drawClosed" });
    expect(game).toBe(before);
  });
});

describe("drawClosed export still works", () => {
  it("is the same as the action", () => {
    const a = createMatch(points2, seats, 4);
    const b = createMatch(points2, seats, 4);
    const id = a.seats[a.turn]!.id;
    expect(applyAction(a, id, { type: "drawClosed" }).phase).toBe(drawClosed(b, id).phase);
  });
});
