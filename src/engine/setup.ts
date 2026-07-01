// New-game setup, faithful to the PDF's 8-step SETUP with rulings baked in.

import type { Card, GameState } from "./types";
import { fullDeck, isKing, isJoker } from "./cards";
import { makeRng, shuffle, randInt, type Rng } from "./rng";
import { maxStamina } from "./balance";

const OPENING_HAND = 5;

/** Create a fresh, reproducible game from a numeric seed and deck count (1–5). */
export function setup(seed: number, decks = 1): GameState {
  const deckCount = Math.max(1, Math.min(5, Math.floor(decks)));
  const rng = makeRng(seed);

  const all = fullDeck(deckCount);
  const kings = all.filter(isKing); // 4 per deck
  const nonKings = all.filter((c) => !isKing(c));

  // Choose exactly ONE King (across all decks) to be the Lich — still a single boss.
  const lich = kings[randInt(rng, kings.length)];
  const otherKings = kings.filter((k) => k.id !== lich.id); // the rest become Warlords

  // Shuffle everything but the Lich, then bury the Lich in the bottom third.
  const shuffled = shuffle([...nonKings, ...otherKings], rng);
  const deck = buryLich(shuffled, lich, rng); // index 0 = TOP

  const state: GameState = {
    seed,
    decks: deckCount,
    lichId: lich.id,
    turn: 1,
    phase: "flip",
    deck,
    hand: [],
    row: [],
    discard: [],
    stamina: maxStamina(deckCount),
    ironFlipUsed: false,
    skipFlipNextTurn: false,
    skipSuffer: false,
    restsUsed: 0,
    burnsUsed: 0,
    status: { kind: "playing" },
    log: [{ turn: 1, phase: "flip", text: "The graveyard stirs. Your watch begins." }],
  };

  // Step 6: deal the opening hand. A Joker dealt during setup fires its (no-op at setup)
  // Omen, is discarded, and a replacement is drawn. Repeat until 5 non-Joker cards are held.
  dealOpeningHand(state);

  return state;
}

/** Insert the Lich into the bottom third of the deck (top = index 0, so bottom = high indices). */
function buryLich(deck53: Card[], lich: Card, rng: Rng): Card[] {
  const bottomThirdStart = Math.floor(deck53.length * (2 / 3)); // ~index 35 of 53
  const span = deck53.length - bottomThirdStart + 1; // inclusive of the very bottom
  const pos = bottomThirdStart + randInt(rng, span);
  const deck = deck53.slice();
  deck.splice(pos, 0, lich);
  return deck;
}

function dealOpeningHand(state: GameState): void {
  while (state.hand.length < OPENING_HAND && state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (isJoker(card)) {
      // Omen at setup: reordering the top 5 has no forced effect; discard and redraw.
      state.discard.push(card);
      state.log.push({ turn: 1, phase: "flip", text: "An Omen flickers during setup and fades." });
      continue;
    }
    state.hand.push(card);
  }
}
