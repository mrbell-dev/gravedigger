import { describe, it, expect } from "vitest";
import { apply, validCombo, firingSuit, effectiveValue } from "./index";
import { makeEnemy } from "./enemy";
import type { GameState, Card, Suit, Enemy } from "./types";

const C = (suit: Suit, rank: number): Card => ({
  id: `${suit}${rank}`,
  kind: "standard",
  suit,
  rank: rank as Card["rank"],
});
const en = (suit: Suit, rank: number, fest = 0, splash = 0): Enemy => {
  const e = makeEnemy(C(suit, rank), false);
  e.festering = fest;
  e.splash = splash;
  return e;
};
const lichEnemy = (): Enemy => makeEnemy({ id: "KH", kind: "standard", suit: "H", rank: 13 }, true);

const base = (o: Partial<GameState>): GameState => ({
  seed: 0,
  decks: 1,
  lichId: "KH",
  turn: 1,
  phase: "act",
  deck: [],
  hand: [],
  row: [],
  discard: [],
  stamina: 10,
  ironFlipUsed: false,
  skipFlipNextTurn: false,
  skipSuffer: false,
  status: { kind: "playing" },
  log: [],
  ...o,
});

describe("combos", () => {
  it("same suit is legal; same rank different suit is legal", () => {
    expect(validCombo([C("H", 6), C("H", 9)])).toBe(true); // 6♥+9♥
    expect(validCombo([C("S", 8), C("C", 8)])).toBe(true); // 8♠+8♣
  });
  it("different suit AND different rank is illegal; 3-card is illegal", () => {
    expect(validCombo([C("H", 5), C("S", 7)])).toBe(false); // 5♥+7♠
    expect(validCombo([C("H", 5), C("H", 6), C("H", 7)])).toBe(false);
  });
  it("firing suit: same-suit combo fires that suit; same-rank uses the chosen suit", () => {
    expect(firingSuit([C("H", 6), C("H", 9)])).toBe("H");
    expect(firingSuit([C("S", 8), C("C", 8)], "C")).toBe("C");
  });
});

describe("festering math", () => {
  it("a Revenant (7) with 3 tokens has effective value 13", () => {
    expect(effectiveValue(en("S", 7, 3))).toBe(13);
  });
});

describe("suit immunity (damage lands, power suppressed)", () => {
  it("Salt is suppressed against a Clubs enemy — no token is removed elsewhere", () => {
    const s = base({
      hand: [C("C", 9), C("S", 2)], // extra card so we aren't stuck afterward
      row: [en("C", 6), en("H", 5, 1)], // kill the club; a festered heart to observe
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "C6", chosenSuit: "C" });
    expect(after.row.find((e) => e.id === "C6")).toBeUndefined(); // 9 >= 6 => killed
    expect(after.row.find((e) => e.id === "H5")!.festering).toBe(1); // Salt did NOT fire
  });

  it("Fire is suppressed against a Hearts enemy — no splash dealt", () => {
    const s = base({
      hand: [C("H", 4), C("H", 5), C("S", 2)],
      row: [en("H", 7), en("S", 8)], // combo 4+5=9 kills the 7♥; splash would hit 8♠
    });
    const after = apply(s, {
      type: "smite",
      cardIds: ["H4", "H5"],
      targetId: "H7",
      chosenSuit: "H",
    });
    expect(after.row.find((e) => e.id === "H7")).toBeUndefined();
    expect(after.row.find((e) => e.id === "S8")!.splash).toBe(0); // Fire suppressed
  });
});

describe("♥ Fire — Splash", () => {
  it("deals 2 to every other enemy; 2 total destroys; fires only once for a same-suit combo", () => {
    const s = base({
      hand: [C("H", 6), C("H", 9), C("S", 2)],
      row: [en("C", 12), en("S", 5), lichEnemy()], // target the club with 6+9=15
    });
    const after = apply(s, {
      type: "smite",
      cardIds: ["H6", "H9"],
      targetId: "C12",
      chosenSuit: "H",
    });
    expect(after.row.find((e) => e.id === "C12")).toBeUndefined(); // killed
    expect(after.row.find((e) => e.id === "S5")).toBeUndefined(); // 2 splash destroys it
    expect(after.row.find((e) => e.role === "lich")!.hp).toBe(18); // fired ONCE (20-2), not twice
  });
});

describe("♠ Iron — Break Through", () => {
  it("a kill flips the next card into the row, and it attacks this same turn", () => {
    const s = base({
      hand: [C("S", 9), C("C", 2)],
      row: [en("H", 6)], // 9 >= 6 kill; H target so Iron is not suppressed
      deck: [C("D", 4)], // the chain-flip reveals this enemy
    });
    const after = apply(s, { type: "smite", cardIds: ["S9"], targetId: "H6", chosenSuit: "S" });
    expect(after.row.find((e) => e.id === "D4")).toBeDefined(); // chain-flipped into the row
    expect(after.stamina).toBe(9); // the new enemy attacked during this turn's Suffer (1 lost)
  });
});

describe("♦ Silver — Precision", () => {
  it("a kill draws 2 cards immediately", () => {
    const s = base({
      hand: [C("D", 9)],
      row: [en("C", 6)], // club target so Silver (diamond) isn't suppressed
      deck: [C("S", 2), C("S", 3)],
    });
    const after = apply(s, { type: "smite", cardIds: ["D9"], targetId: "C6", chosenSuit: "D" });
    expect(after.hand.map((c) => c.id).sort()).toEqual(["S2", "S3"]);
  });
});

describe("♣ Salt — Suppress", () => {
  it("removes one festering token when any exists", () => {
    const s = base({
      hand: [C("C", 9), C("S", 2)],
      row: [en("H", 6), en("S", 4, 2)], // kill heart; a spade with 2 tokens to cleanse
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "H6", chosenSuit: "C" });
    expect(after.row.find((e) => e.id === "S4")!.festering).toBe(1); // one token removed
  });

  it("with no festering anywhere, offers a top-2 reorder (pending)", () => {
    const s = base({
      hand: [C("C", 9), C("S", 2)],
      row: [en("H", 6)],
      deck: [C("D", 2), C("D", 3), C("D", 4)],
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "H6", chosenSuit: "C" });
    const p = after.pending;
    expect(p?.kind).toBe("reorder");
    if (p?.kind === "reorder") {
      expect(p.source).toBe("salt-peek");
      expect(p.count).toBe(2);
    }
  });

  it("with 2+ festered enemies, pauses to let the player choose which to cleanse", () => {
    const s = base({
      hand: [C("C", 9), C("S", 2)],
      row: [en("H", 6), en("S", 4, 1), en("D", 3, 2)], // two festered enemies => a real choice
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "H6", chosenSuit: "C" });
    expect(after.pending?.kind).toBe("salt-remove");
    // Resolving it removes exactly one token from the chosen enemy.
    const done = apply(after, { type: "salt-remove", targetId: "D3" });
    expect(done.row.find((e) => e.id === "D3")!.festering).toBe(1);
    expect(done.row.find((e) => e.id === "S4")!.festering).toBe(1); // untouched
  });
});

describe("scoring a win", () => {
  it("rewards leftover stamina and unused hand cards, scaled by difficulty", () => {
    // One enemy, empty deck: killing it wins immediately. Hand keeps its other cards.
    const s = base({
      stamina: 7,
      hand: [C("C", 9), C("S", 2), C("S", 3)], // kill with the 9♣, leaving 2 tools unused
      row: [en("H", 6)],
      deck: [],
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "H6", chosenSuit: "C" });
    expect(after.status.kind).toBe("won");
    if (after.status.kind === "won") {
      const sc = after.status.score;
      expect(sc.unusedCards).toBe(2); // S2 + S3 remain
      // (7*10 stamina + 2*25 efficiency + 100 clear) * 1 deck = 220
      expect(sc.total).toBe(220);
    }
  });

  it("multiplies by deck count", () => {
    const s = base({
      decks: 3,
      stamina: 5,
      hand: [C("C", 9)],
      row: [en("H", 6)],
      deck: [],
    });
    const after = apply(s, { type: "smite", cardIds: ["C9"], targetId: "H6", chosenSuit: "C" });
    if (after.status.kind === "won") {
      // (5*10 + 0*25 + 100) * 3 = 450
      expect(after.status.score.total).toBe(450);
      expect(after.status.score.difficultyMult).toBe(3);
    }
  });
});

describe("Burn", () => {
  it("discards exactly the 2 chosen cards and removes the enemy (no power fires)", () => {
    const s = base({
      hand: [C("S", 2), C("S", 3), C("H", 9)],
      row: [en("C", 6), en("D", 10)], // second enemy so the game doesn't end mid-check
      deck: [C("D", 4), C("D", 5)],
    });
    const after = apply(s, { type: "burn", cardIds: ["S2", "S3"], targetId: "C6" });
    expect(after.row.find((e) => e.id === "C6")).toBeUndefined(); // enemy removed
    expect(after.discard.some((c) => c.id === "S2")).toBe(true); // both burned cards discarded
    expect(after.discard.some((c) => c.id === "S3")).toBe(true);
    expect(after.hand.some((c) => c.id === "S2")).toBe(false); // and gone from hand
    expect(after.hand.some((c) => c.id === "S3")).toBe(false);
    expect(after.hand.some((c) => c.id === "H9")).toBe(true); // the unselected card stays
  });
});

describe("hand-limit discard (mid-turn overfill)", () => {
  it("Silver drawing past 5 pauses for a player discard choice", () => {
    // Full hand; Silver kill draws +2 => hand of 6 => must shed 1. A second enemy + leftover
    // deck cards keep the game from ending before Refill.
    const s = base({
      hand: [C("D", 9), C("S", 2), C("S", 3), C("S", 4), C("S", 5)],
      row: [en("C", 6), en("D", 10)],
      deck: [C("H", 7), C("H", 8), C("H", 2)],
    });
    const after = apply(s, { type: "smite", cardIds: ["D9"], targetId: "C6", chosenSuit: "D" });
    expect(after.pending?.kind).toBe("discard");
    const done = apply(after, { type: "discard", cardIds: ["S2"] });
    expect(done.pending).toBeUndefined();
    expect(done.hand.length).toBeLessThanOrEqual(5);
    expect(done.hand.find((c) => c.id === "S2")).toBeUndefined();
  });
});
