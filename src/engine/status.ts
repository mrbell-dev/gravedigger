// Win / loss detection and victory tiers.

import type { GameState, Score } from "./types";
import { isAce } from "./cards";
import { toolValue } from "./cards";
import { maxStamina } from "./balance";

const STAMINA_POINTS = 10; // per remaining stamina
const EFFICIENCY_POINTS = 25; // per tool left unused in hand
const CLEAR_BONUS = 100; // flat reward for winning
const SPEED_POINTS = 2; // per turn faster than par
const SPEED_PAR_PER_DECK = 30; // "par" turn count per deck; finishing under it earns speed points
const REST_PENALTY = 15; // deducted per Rest (stalling)
const BURN_PENALTY = 20; // deducted per Burn (skipping a fight by sacrificing tools)

/**
 * Score a won game. Rewards: leftover stamina, tools left unused in hand, and a fast clear
 * (fewer turns than par). Penalizes Rests (stalling) and Burns (skipping fights). Scaled by
 * difficulty (deck count). The pre-multiplier subtotal is floored at 0 so heavy penalties can't
 * produce a negative score.
 */
export function scoreWin(state: GameState): Score {
  const unusedCards = state.hand.length; // deck is empty at a win; hand = tools never spent
  const staminaBonus = state.stamina * STAMINA_POINTS;
  const efficiencyBonus = unusedCards * EFFICIENCY_POINTS;
  const par = SPEED_PAR_PER_DECK * state.decks;
  const speedBonus = Math.max(0, par - state.turn) * SPEED_POINTS;
  const restPenalty = state.restsUsed * REST_PENALTY;
  const burnPenalty = state.burnsUsed * BURN_PENALTY;
  const difficultyMult = state.decks;

  const subtotal = Math.max(
    0,
    staminaBonus + efficiencyBonus + CLEAR_BONUS + speedBonus - restPenalty - burnPenalty,
  );
  const total = Math.round(subtotal * difficultyMult);
  return {
    staminaBonus,
    efficiencyBonus,
    clearBonus: CLEAR_BONUS,
    speedBonus,
    restPenalty,
    burnPenalty,
    difficultyMult,
    unusedCards,
    turns: state.turn,
    rests: state.restsUsed,
    burns: state.burnsUsed,
    total,
  };
}

export function victoryTier(stamina: number, decks = 1): "gold" | "silver" | "bronze" {
  const cap = maxStamina(decks);
  if (stamina >= 0.8 * cap) return "gold";
  if (stamina >= 0.5 * cap) return "silver";
  return "bronze";
}

/** Checked after every phase (ruling R4). Sets status to won/lost when appropriate. */
export function checkWinLoss(state: GameState): void {
  if (state.status.kind !== "playing") return;

  if (state.stamina <= 0) {
    state.status = { kind: "lost", reason: "stamina" };
    return;
  }
  // Win: the deck is empty and the row has been fully cleared.
  if (state.deck.length === 0 && state.row.length === 0) {
    state.status = {
      kind: "won",
      tier: victoryTier(state.stamina, state.decks),
      stamina: state.stamina,
      score: scoreWin(state),
    };
  }
}

const isTool = (c: { rank?: number; kind: string }): boolean =>
  c.kind === "standard" && toolValue(c as never) > 0;

/**
 * Ruling R5: at the ACT step, with enemies present, is the player unable to make progress?
 * Productive actions = Smite, Burn, or a festering-clearing Ritual. Rest is NOT an escape
 * (stalling); a do-nothing Ritual is NOT an escape either.
 */
export function isStuck(state: GameState): boolean {
  if (state.row.length === 0) return false; // nothing to fight; will flip/refill/win

  const nonAce = state.hand.filter((c) => !isAce(c) && c.kind === "standard");
  const canSmite = state.hand.some(isTool); // any tool can attack some enemy
  const canBurn = nonAce.length >= 2 && state.row.some((e) => e.role !== "lich");
  const canClearRitual = state.hand.some(isAce) && state.row.some((e) => e.festering > 0);
  if (canSmite || canBurn || canClearRitual) return false;

  // No productive action. Can we legally Rest to draw into something better?
  const rowFull = state.row.length >= (state.row.some((e) => e.role === "lich") ? 4 : 3);
  const restBlocked = rowFull || (state.deck.length === 0 && nonAce.length < 2);
  // Resting only helps if the deck can still feed us new cards.
  const restUseful = !restBlocked && state.deck.length > 0;
  return !restUseful;
}
