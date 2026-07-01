# Gravedigger — project guide for Claude

A mobile-first, browser-based PWA of the *Gravedigger* solitaire card game. 100% client-side,
no backend. See `PLAN.md` for the full roadmap + current STATUS, and `src/engine/RULES.md` for the
canonical ruleset (also the source for the in-app How-to-Play).

## Architecture — the one rule that matters
**The engine is pure and must stay that way.** `src/engine/` has zero DOM/React/I-O. The UI never
mutates game state — it calls `apply(state, action)` and renders the returned state. This is what
makes the game testable, replayable, and reproducible. Do not leak React or side effects into the
engine, and do not duplicate rules logic in the UI.

```
src/engine/   pure rules core (see below)
src/ui/       React: App.tsx + styles.css (renders state, dispatches actions)
src/sim/      headless balance bot (npm run sim)
scripts/      shoot.mjs — Playwright build+drive+screenshot to ./shots
```

### Engine modules
- `types.ts` — `GameState`, `Enemy`, `Card`, `Action`, `Pending`. All state lives here.
- `rng.ts` — seeded mulberry32 + shuffle. Same seed ⇒ identical game (keep it that way).
- `cards.ts` / `enemy.ts` — card + enemy construction, values, `effectiveValue`.
- `setup.ts` — faithful 8-step new game (Lich buried in bottom third).
- `turn.ts` — the phase machine. `run(state)` auto-advances Flip→Suffer→Refill and stops at ACT,
  a `pending` reorder, or terminal. Also: Silver's resumable draw, Lich Corruption, hand trim.
- `actions.ts` — `legalActions`, `apply`, `isLegal`, Smite/Ritual/Rest/Burn, combo validation.
- `suits.ts` — the four suit powers. `kill.ts` — shared destroy helpers.
- `status.ts` — win/loss + victory tiers + `isStuck` (ruling R5).
- `index.ts` — the ONLY public surface. UI + sim import from here.

## Load-bearing rulings (don't "fix" these — they're deliberate; full list in PLAN.md A3)
- **R1:** a Smite fires **at most one** suit power ⇒ Iron and Silver can never both trigger.
- **R3:** Iron's chain-flip is a full Flip (can reveal Lich/Ace/Joker) and consumes next turn's Flip.
- **R4:** win/loss checked after every phase. **R5:** loss = no *productive* action (Rest/do-nothing
  Ritual don't count as escapes) — implemented in `isStuck`.
- **R8:** a Joker skips Suffer only when revealed in Flip or an Iron chain-flip, not via Silver/Refill.
- Immunity suppresses the matching-suit power but damage still lands.

## Workflow
- **Test:** `npm test` (Vitest). Every rule + PDF worked example is a test; add one for any rule
  change. Current: 36 passing across rng/setup/game/rules/lich.
- **Verify visually:** `npm run build && node scripts/shoot.mjs` → screenshots in `./shots`. This is
  how we confirm UI changes without the user reading code — always screenshot after UI work and send
  it (the user is often on mobile).
- **Balance:** `npm run sim -- 4000`. Watch for `Unfinished` > 0 → that's an engine loop bug.
- **Build:** `npm run build` (tsc strict + Vite). `noUnusedLocals` is on — keep imports clean.

## Conventions
- TypeScript strict. Deterministic engine: no `Date.now()`/`Math.random()` inside `src/engine`
  (seed the RNG instead). `apply` deep-clones via `structuredClone` and never mutates its input.
- Keep the gothic tone in UI copy and the Chronicle log lines.
- Prefer adding to `src/engine/RULES.md` when changing rules so the in-app help can't drift.

## Player-choice decisions
`Pending` (types.ts) pauses the machine for player input: `reorder` (Omen/Salt peek),
`salt-remove` (which enemy to cleanse — only when 2+ are festered), `discard` (trim an overfull
hand). Each has a UI modal in App.tsx and a bot/sim default via `defaultPendingAction`. No
auto-resolve shortcuts remain in the UI.
