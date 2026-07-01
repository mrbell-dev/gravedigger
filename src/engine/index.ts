// Public engine API. UI and sim import only from here.

import type { GameState } from "./types";
import { setup } from "./setup";
import { run } from "./turn";

export * from "./types";
export {
  apply,
  legalActions,
  isLegal,
  restLegal,
  validCombo,
  firingSuit,
  defaultPendingAction,
} from "./actions";
export { effectiveValue } from "./enemy";
export { victoryTier } from "./status";
export { cardLabel, toolValue, enemyName, SUIT_NAME, SUIT_SYMBOL, isAce, isJoker } from "./cards";
export { rowLimit } from "./turn";
export { seedFromString } from "./rng";

/** Start a new, reproducible game and advance to the first decision point. */
export function newGame(seed: number, decks = 1): GameState {
  const s = setup(seed, decks);
  run(s);
  return s;
}
