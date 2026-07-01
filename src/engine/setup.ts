// New-game setup, faithful to the PDF's 8-step SETUP with rulings baked in.

import type { Card, GameState } from "./types";
import { fullDeck, isKing, isJoker } from "./cards";
import { makeRng, shuffle, randInt, type Rng } from "./rng";

const STARTING_STAMINA = 10;
const OPENING_HAND = 5;

/** Create a fresh, reproducible game from a numeric seed. */
export function setup(seed: number): GameState {
  const rng = makeRng(seed);

  const all = fullDeck();
  const kings = all.filter(isKing);
  const nonKings = all.filter((c) => !isKing(c)); // 48 standard + 2 jokers = 50

  // Step 2: choose one King at random to be the Lich.
  const lich = kings[randInt(rng, kings.length)];
  const otherKings = kings.filter((k) => k.id !== lich.id); // the 3 Warlords-to-be

  // Step 3–4: shuffle the 50, then shuffle the 3 non-Lich Kings back in => 53 cards.
  const deck53 = shuffle([...nonKings, ...otherKings], rng);

  // Step 5: bury the Lich face-down at a random spot in the bottom third (~last 17).
  const deck = buryLich(deck53, lich, rng); // 54 cards, index 0 = TOP

  const state: GameState = {
    seed,
    lichId: lich.id,
    turn: 1,
    phase: "flip",
    deck,
    hand: [],
    row: [],
    discard: [],
    stamina: STARTING_STAMINA,
    ironFlipUsed: false,
    skipFlipNextTurn: false,
    skipSuffer: false,
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
