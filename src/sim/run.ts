// Headless balance simulator. Plays many seeded games with a competent heuristic bot and
// reports win rate, victory-tier distribution, and loss reasons.
//   npm run sim            (default 5000 games)
//   npm run sim -- 20000   (custom count)

import { newGame, apply, legalActions, effectiveValue, defaultPendingAction } from "../engine";
import type { GameState, Action } from "../engine";

function cardVal(s: GameState, id: string): number {
  const c = s.hand.find((x) => x.id === id);
  return !c || c.rank === 1 ? 0 : (c.rank ?? 0);
}
function attackVal(s: GameState, a: Action & { type: "smite" }): number {
  return a.cardIds.reduce((n, id) => n + cardVal(s, id), 0);
}

/** A reasonably skilled greedy strategy: kill the biggest threat cheaply; manage festering; survive. */
function chooseMove(s: GameState): Action | undefined {
  const actions = legalActions(s);
  if (actions.length === 0) return undefined;

  const smites = actions.filter((a): a is Action & { type: "smite" } => a.type === "smite");

  // 1) Lethal smites: kill the highest effective-value enemy, using the least attack value.
  const lethal = smites
    .map((a) => {
      const t = s.row.find((e) => e.id === a.targetId)!;
      const val = attackVal(s, a);
      const kills = t.role === "lich" ? false : val >= effectiveValue(t);
      return { a, val, threat: t.role === "lich" ? 99 : effectiveValue(t), kills };
    })
    .filter((x) => x.kills)
    .sort((x, y) => y.threat - x.threat || x.val - y.val)[0];
  if (lethal) return lethal.a;

  // 2) If festering is getting out of hand and we hold an Ace, cleanse.
  const totalFester = s.row.reduce((n, e) => n + e.festering, 0);
  const ritual = actions.find((a) => a.type === "ritual");
  if (ritual && totalFester >= 4) return ritual;

  // 3) If the row is dangerously full, Burn the biggest non-Lich threat.
  const burn = actions.find((a) => a.type === "burn");
  if (burn && s.row.filter((e) => e.role !== "lich").length >= 3) return burn;

  // 4) Chip away (highest-value smite) — progress beats stalling.
  const best = smites.map((a) => ({ a, val: attackVal(s, a) })).sort((x, y) => y.val - x.val)[0];
  if (best) return best.a;

  // 5) Recover if we can.
  return actions.find((a) => a.type === "rest") ?? actions[0];
}

function playGame(seed: number): GameState {
  let s = newGame(seed);
  let steps = 0;
  while (s.status.kind === "playing" && steps < 5000) {
    if (s.pending) {
      s = apply(s, defaultPendingAction(s)!);
      continue;
    }
    const move = chooseMove(s);
    if (!move) break;
    s = apply(s, move);
    steps++;
  }
  return s;
}

const N = Number(process.argv[2] ?? 5000);
const tally = {
  won: 0,
  gold: 0,
  silver: 0,
  bronze: 0,
  lostStamina: 0,
  lostStuck: 0,
  unfinished: 0,
};

for (let seed = 0; seed < N; seed++) {
  const s = playGame(seed);
  if (s.status.kind === "won") {
    tally.won++;
    tally[s.status.tier]++;
  } else if (s.status.kind === "lost") {
    if (s.status.reason === "stamina") tally.lostStamina++;
    else tally.lostStuck++;
  } else {
    tally.unfinished++;
  }
}

const pct = (n: number) => ((100 * n) / N).toFixed(1) + "%";
console.log(`\nGravedigger balance — ${N} games, heuristic bot\n${"-".repeat(40)}`);
console.log(`Win rate        ${pct(tally.won)}  (${tally.won})`);
console.log(`  Gold  (8-10)  ${pct(tally.gold)}`);
console.log(`  Silver (5-7)  ${pct(tally.silver)}`);
console.log(`  Bronze (1-4)  ${pct(tally.bronze)}`);
console.log(`Loss: stamina   ${pct(tally.lostStamina)}`);
console.log(`Loss: no move   ${pct(tally.lostStuck)}`);
if (tally.unfinished) console.log(`Unfinished      ${tally.unfinished} (BUG — investigate)`);
console.log("");
