// The four suit powers. Exactly one fires per Smite (ruling R1), and only if not suppressed by
// Immunity. Iron and Silver require a kill; Salt and Fire fire regardless of the outcome.

import type { GameState, Suit, Enemy } from "./types";
import { isJoker, isAce } from "./cards";
import { makeEnemy } from "./enemy";
import { log } from "./turn";
import { defeatLich, destroyBySplash } from "./kill";

export function fireSuitPower(s: GameState, suit: Suit, killed: boolean, target: Enemy): void {
  switch (suit) {
    case "S":
      if (killed) ironBreakThrough(s);
      break;
    case "C":
      saltSuppress(s);
      break;
    case "H":
      fireSplash(s, target);
      break;
    case "D":
      if (killed) silverPrecision(s);
      break;
  }
}

/** ♠ Iron — Break Through: after a kill, flip the next card now; it replaces next turn's Flip. */
function ironBreakThrough(s: GameState): void {
  if (s.ironFlipUsed) return; // once per turn
  if (s.deck.length === 0) {
    log(s, "Iron finds only empty ground — nothing rises.");
    return; // ruling: empty deck => Iron does nothing (no skip)
  }
  s.ironFlipUsed = true;
  s.skipFlipNextTurn = true; // this chain-flip is next turn's Flip
  const card = s.deck.shift()!;

  if (isJoker(card)) {
    s.discard.push(card);
    log(s, "Iron breaks through into an Omen — The Trickster.");
    // Omen via Iron's chain-flip skips this turn's Suffer (ruling R8).
    s.pending = {
      kind: "reorder",
      count: Math.min(5, s.deck.length),
      source: "omen",
      skipSufferAfter: true,
      resumePhase: "refill",
    };
    return;
  }
  if (isAce(card)) {
    s.hand.push(card);
    log(s, "Iron breaks through — a Ritual card falls into your hand.");
    return;
  }
  const enemy = makeEnemy(card, card.id === s.lichId);
  s.row.push(enemy);
  log(s, `Iron breaks through — another enemy rises (it attacks this turn).`);
}

/** ♣ Salt — Suppress: clear one festering token; or, if none exist, reorder the top 2. */
function saltSuppress(s: GameState): void {
  const festered = s.row.filter((e) => e.festering > 0);
  if (festered.length > 1) {
    // A real choice: let the player pick which enemy loses a token.
    s.pending = { kind: "salt-remove", resumePhase: "suffer" };
    log(s, "Salt is ready — choose an enemy to cleanse.");
    return;
  }
  if (festered.length === 1) {
    festered[0].festering -= 1; // only one candidate; no decision to make
    log(s, "Salt suppresses a festering token.");
    return;
  }
  if (s.deck.length > 0) {
    log(s, "Salt reveals the graveyard's next breaths.");
    s.pending = {
      kind: "reorder",
      count: Math.min(2, s.deck.length),
      source: "salt-peek",
      skipSufferAfter: false,
      resumePhase: "suffer",
    };
  }
}

/** ♥ Fire — Splash: 2 splash to every OTHER enemy; 2 total destroys; Lich takes it as HP. */
function fireSplash(s: GameState, target: Enemy): void {
  const others = s.row.filter((e) => e.id !== target.id);
  for (const e of others) {
    if (e.role === "lich") {
      e.hp = (e.hp ?? 0) - 2;
      log(s, `Fire scorches the Lich for 2. ${Math.max(0, e.hp)} HP remains.`);
      if (e.hp <= 0) defeatLich(s, e);
    } else {
      e.splash += 2;
      if (e.splash >= 2) destroyBySplash(s, e);
    }
  }
}

/** ♦ Silver — Precision: on a kill, draw 2 now. Resumable if an Omen interrupts. */
function silverPrecision(s: GameState): void {
  s.silverDraws = 2;
  log(s, "Silver's precision — you draw from the graveyard.");
  // The actual draw is performed by the turn loop (drawSilver), so an Omen can pause it.
}
