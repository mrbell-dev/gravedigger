// The turn state machine. Auto-advances through phases that need no player input
// (Flip, Suffer, Refill) and stops at ACT (needs a choice), a pending reorder, or a terminal state.

import type { GameState, Card } from "./types";
import { isAce, isJoker } from "./cards";
import { makeEnemy } from "./enemy";
import { checkWinLoss, isStuck } from "./status";

const MAX_STAMINA = 10;

export function log(state: GameState, text: string): void {
  state.log.push({ turn: state.turn, phase: state.phase, text });
}

export function rowLimit(state: GameState): number {
  return state.row.some((e) => e.role === "lich") ? 4 : 3;
}

export function gainStamina(state: GameState, amount: number): void {
  state.stamina = Math.min(MAX_STAMINA, state.stamina + amount);
}

/** Advance the game until it needs player input (ACT / reorder) or reaches a terminal state. */
export function run(state: GameState): void {
  // Safety bound: a full game is < a few hundred steps; this guards against logic loops.
  for (let guard = 0; guard < 10000; guard++) {
    checkWinLoss(state);
    if (state.status.kind !== "playing") return;
    if (state.pending) return;

    // Silver's mid-Act draw runs here so an Omen can pause and resume it cleanly.
    if (state.silverDraws && state.silverDraws > 0) {
      drawSilver(state);
      continue;
    }

    switch (state.phase) {
      case "flip":
        doFlip(state);
        break;
      case "act":
        if (isStuck(state)) {
          state.status = { kind: "lost", reason: "no-legal-action" };
          log(state, "No move remains. The dead overrun the living.");
        }
        return; // player must choose (or we've lost)
      case "suffer":
        doSuffer(state);
        break;
      case "refill":
        doRefill(state);
        if (state.pending) return;
        startNextTurn(state);
        break;
    }
  }
  throw new Error("run() exceeded step bound — likely a rules logic loop");
}

/** FLIP: reveal the top card and route it. */
function doFlip(state: GameState): void {
  if (state.deck.length === 0) {
    // Deck exhausted: no Flip. Fight down the remaining row.
    state.phase = "act";
    return;
  }
  const card = state.deck.shift()!;

  if (isJoker(card)) {
    state.discard.push(card);
    log(state, "An Omen rises — The Trickster. No enemy emerges.");
    // Omen in Flip: reorder top 5, skip Act & Suffer, go to Refill.
    state.pending = {
      kind: "reorder",
      count: Math.min(5, state.deck.length),
      source: "omen",
      skipSufferAfter: true,
      resumePhase: "refill",
    };
    return;
  }

  if (isAce(card)) {
    state.hand.push(card);
    log(state, "A Ritual card comes to hand.");
    state.phase = "act";
    return;
  }

  const enemy = makeEnemy(card, card.id === state.lichId);
  state.row.push(enemy);
  if (enemy.role === "lich") log(state, "THE LICH claws free of the earth. 20 HP.");
  else if (enemy.role === "warlord") log(state, "A Warlord enters the row (value 13).");
  else log(state, `An enemy enters the row (value ${enemy.base}).`);
  state.phase = "act";
}

/** SUFFER: Lich Corruption fires first, then every surviving enemy costs 1 Stamina. */
function doSuffer(state: GameState): void {
  if (state.skipSuffer) {
    state.skipSuffer = false;
    state.phase = "refill";
    return;
  }
  lichCorruption(state);
  const survivors = state.row.length;
  if (survivors > 0) {
    state.stamina = Math.max(0, state.stamina - survivors);
    log(state, `You Suffer — ${survivors} Stamina lost. (${state.stamina} left.)`);
  }
  state.phase = "refill";
}

/**
 * Lich Corruption: at the start of Suffer, count this as another turn the Lich has survived.
 * On its even turns (2nd, 4th, …) it adds one festering token to every OTHER enemy in the row.
 */
function lichCorruption(state: GameState): void {
  const lich = state.row.find((e) => e.role === "lich");
  if (!lich) return;
  lich.lichTurns = (lich.lichTurns ?? 0) + 1;
  if (lich.lichTurns % 2 === 0) {
    let n = 0;
    for (const e of state.row) {
      if (e.role !== "lich") {
        e.festering += 1;
        n++;
      }
    }
    if (n > 0) log(state, `The Lich's Corruption festers ${n} enemy(ies).`);
  }
}

/** Silver's draw: pull up to `silverDraws` cards now; an Omen pauses and later resumes this. */
function drawSilver(state: GameState): void {
  while ((state.silverDraws ?? 0) > 0 && state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (isJoker(card)) {
      state.discard.push(card);
      log(state, "Silver draws an Omen — The Trickster (Suffer is not skipped).");
      state.pending = {
        kind: "reorder",
        count: Math.min(5, state.deck.length),
        source: "omen",
        skipSufferAfter: false,
        resumePhase: "act", // run() resumes the remaining draws before the phase switch
      };
      return;
    }
    state.hand.push(card);
    state.silverDraws! -= 1;
  }
  // Draws finished (or deck ran dry): the Smite is fully resolved; proceed to Suffer.
  state.silverDraws = undefined;
  state.phase = "suffer";
}

/** REFILL: draw up to 5. A Joker drawn here fires an Omen (no Suffer-skip) and pauses for reorder. */
function doRefill(state: GameState): void {
  // Discard down to 5 first if mid-turn draws (Silver / Iron-flipped Ace) overfilled the hand.
  if (state.hand.length > 5) {
    state.pending = { kind: "discard", downTo: 5, resumePhase: "refill" };
    log(state, "Your hand overflows — choose what to let fall.");
    return;
  }
  while (state.hand.length < 5 && state.deck.length > 0) {
    const card = state.deck.shift()!;
    if (isJoker(card)) {
      state.discard.push(card);
      log(state, "An Omen surfaces as you draw — The Trickster.");
      state.pending = {
        kind: "reorder",
        count: Math.min(5, state.deck.length),
        source: "omen",
        skipSufferAfter: false,
        resumePhase: "refill",
      };
      return; // resume refill after reorder resolves
    }
    state.hand.push(card);
  }
}

function startNextTurn(state: GameState): void {
  state.turn += 1;
  state.ironFlipUsed = false;
  state.skipSuffer = false;
  if (state.skipFlipNextTurn) {
    // An Iron chain-flip already served as this turn's Flip.
    state.skipFlipNextTurn = false;
    state.phase = "act";
  } else {
    state.phase = "flip";
  }
}

/** Move played cards from hand to discard (used by Smite/Burn/Ritual). */
export function discardFromHand(state: GameState, cardIds: string[]): Card[] {
  const moved: Card[] = [];
  for (const id of cardIds) {
    const idx = state.hand.findIndex((c) => c.id === id);
    if (idx === -1) continue;
    const [c] = state.hand.splice(idx, 1);
    state.discard.push(c);
    moved.push(c);
  }
  return moved;
}
