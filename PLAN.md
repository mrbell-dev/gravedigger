# Gravedigger — Development Plan (start to finish)

A single-player, browser-based, mobile-first digital version of the *Gravedigger* solitaire
card game. Fully client-side, installable as a PWA, works offline.

**Decisions locked:** Web app · React + TypeScript · pure engine separated from UI · mobile-first · open-source/CC assets only. Rules v1 rulings (R1–R10) approved as-is. Gothic theme (Pirata One + EB Garamond). In-game How-to-Play + contextual hints required. Difficulty variants deferred past 1.0.

---

## STATUS — updated 2026-07-01

**SHIPPED (Phase 12, early):** Live at https://mrbell-dev.github.io/gravedigger/ · repo
github.com/mrbell-dev/gravedigger (public, proprietary LICENSE, @Pavornic credited). CI auto-deploys
on push to `main` (`.github/workflows/deploy.yml`); verified live render. Order was 10 → 9 → 11 → 12,
but 12 was pulled forward for a shareable review link. STILL PENDING: **Phase 9 (juice)** and
**Phase 11 (QA/a11y)**.


**Tests:** 36 passing. **Balance sim:** 4000 games, 0 unfinished (no logic loops); heuristic bot win rate ~18.6% (Gold 8.0% / Silver 5.9% / Bronze 4.7%), losses 62% stamina / 19% no-move. Intentionally hard; bot is only greedy, revisit later.

### Done
- **Phase 0 — Foundations.** Vite + React + TS + Vitest scaffold. `npm test` / `build` / `dev` all green. `.gitignore` in place. (Not yet `git init`'d.)
- **Phase 1 — Engine core.** `rng` (seeded, reproducible), `types`, `cards`, `setup` (faithful 8-step), turn machine (`turn.ts`: flip/suffer/refill + `run()` auto-advance), `actions` (legalActions/apply), `status` (win/loss + tiers + R5 stuck-detection). Rest/Burn/Smite/Ritual/Omen all work. `RULES.md` = canonical rules + in-app How-to-Play source.
- **Phase 2 — Full rules.** Four suit powers (`suits.ts`), Immunity, combos, festering vs splash, mid-turn Silver draws (resumable through an Omen), Iron chain-flip, hand-limit auto-trim. All PDF worked examples pass (`rules.test.ts`).
- **Phase 3 — Lich & Warlords.** 20 HP, no-fester, Corruption on even turns, +3 on defeat, row-limit 4, Warlords as value-13 enemies (`lich.test.ts`).
- **Phase 4 — Balance sim.** `src/sim/run.ts` (`npm run sim`). Confirmed no engine loops; difficulty readout captured above.
- **Phase 5–7 (partial) — UI.** Gothic React board (`ui/App.tsx` + `styles.css`): status bar, enemy row, hand, tap-to-Smite, Rest/Ritual/Burn, Omen + game-over overlays, live Chronicle log. Mobile layout works (390px).
- **Phase 7 — assets/theming.** Self-hosted fonts via `@fontsource` (Pirata One + EB Garamond, latin subset) — identical look offline, no CDN. App icon authored (`src/assets/icon.svg`, gothic tombstone) and rasterized to PWA PNGs via `scripts/icons.mjs` (uses Playwright's Chromium). Combo-power chips + killable highlighting themed.
- **Phase 8 — PWA / installable (mostly done).** `vite-plugin-pwa` (Workbox): manifest (standalone, portrait, themed), service worker, offline precache incl. fonts (~530 KB). iOS + Android meta tags in `index.html`. In-app **Add to Home Screen** prompt (`ui/Install.tsx`): platform-aware — native install on Android Chrome, Share→Add steps on iOS Safari, generic elsewhere; hides once installed; "don't show again" persisted. Full-screen launch confirmed via manifest `display:standalone`.
- **Phase 10 — persistence & meta.** `ui/persist.ts`: localStorage autosave/resume of an in-progress game (verified by reload test — turn survives), lifetime stats (played/wins/tiers/streak), seed sharing via `?seed=` link (copy-link) + "play a specific graveyard" input accepting a number OR a word (`seedFromString`). Menu modal ("The Sexton's Ledger", ≡ top-left). Priority on load: URL seed → saved game → random.
- **Visual verification loop.** Playwright: `scripts/shoot.mjs` (screenshots), `scripts/offline-check.mjs` (offline PASS), `scripts/persist-check.mjs` (resume PASS), `scripts/icons.mjs` (icon raster). This is how progress is verified without the user reading code.

### Remaining / TODO
- **Phase 6:** DONE — How-to-Play screen (renders `RULES.md` via `marked`), interactive Omen/Salt reorder modal (tap-two-to-swap), killable/tough enemy highlighting, same-rank combo suit-power chooser (chips), manual Salt token-target (pauses only when 2+ enemies festered), manual hand-limit discard (both via new `Pending` kinds `salt-remove`/`discard` + `defaultPendingAction` for bots). STILL TODO (minor polish) — surface immunity/power outcomes visually beyond the Chronicle log; disabled-with-reason tooltips.
- **Phase 7 (mostly done):** fonts self-hosted, app icon done. STILL TODO (optional) — game-icons.net art for suits/enemies, richer card faces, texture pass.
- **Phase 8 (mostly done):** manifest, SW, offline, install prompt all done. STILL TODO — real-device test on iOS + Android; safe-area fine-tuning; optional touch-drag. NOTE: `start_url`/`scope` are relative (".") so it works on any Pages subpath; revisit if we set an absolute `base`.
- **Phase 10 — Persistence & meta: DONE** (autosave/resume, seed sharing + word-seeds, stats). Optional later: settings toggles (variants/sound/motion) once those features exist.
- **Phase 9 — Juice (NEXT):** card/enemy animations, damage/kill feedback, optional sound (Kenney/CC0), haptics on mobile, `prefers-reduced-motion` path.
- **Phase 11 — QA & a11y:** cross-device, keyboard nav, screen-reader labels, colorblind-safe suits, fast-check property/fuzz tests.
- **Phase 12 — Ship:** in-app How-to-Play/tutorial screen (render `RULES.md`), CI, deploy to Pages, credits.
- **Also:** `git init` + first commit; `ASSETS.md`; wire suit-power/immunity outcomes into visible UI cues.

### Known simplifications — RESOLVED
All prior UX shortcuts (Salt token target, hand-limit discard, same-rank combo suit, reorder) now
offer full player choice via `Pending` decisions + dedicated modals. Bots/sim use
`defaultPendingAction`. No known rules/UX shortcuts remain.

---

## 0. Guiding principles

1. **The engine is the product.** The rules are 90% bookkeeping (festering vs splash, Lich
   Corruption timers, Iron chain-flip stealing next turn's Flip, Joker Suffer-skip conditions).
   Getting that provably correct is the whole value proposition over playing with real cards.
2. **Pure core, dumb UI.** The engine is a pure module with no DOM, no React, no I/O. React only
   renders a `GameState` and dispatches actions. This keeps testing trivial and lets us reuse the
   same core for a bot/solver and a balance simulator.
3. **Deterministic & reproducible.** Seeded RNG so any game can be replayed, shared, and debugged.
4. **Test-first on the rules.** Every worked example in the PDF and every ruling below becomes a
   unit test before the UI exists.
5. **MVP cut line is Phase 6** (fully playable, unstyled). Everything after is polish, assets,
   mobile, and juice.

---

## Part A — The Ruleset

The engine implements **Canonical Rules v1**: the PDF rules, faithful to designer intent, with
every ambiguity resolved explicitly below. Optional balance variants are kept separate and OFF by
default.

### A1. Turn structure (unchanged from PDF)

`FLIP → ACT → SUFFER → REFILL`, repeat. Deck empty ⇒ skip FLIP and keep going until the row is
clear (win) or you die (loss).

- **FLIP:** reveal top card. Number/J/Q → enemy in row. Non-Lich King → Warlord (value 13). Lich →
  4th enemy, 20 HP. Joker → Omen, skip ACT & SUFFER, go to REFILL. Ace → enters hand as Ritual.
- **ACT (choose one):** Smite · Ritual · Rest · Burn.
- **SUFFER:** lose 1 Stamina per surviving enemy (including ones added mid-turn by Iron's chain-flip).
- **REFILL:** draw up to 5 (discard down to 5 first if mid-turn draws overfilled).

### A2. The pieces (unchanged)

- **Stamina:** start 10, cap 10, lose at 0.
- **Tools (in hand):** 2–10 face value, J=11, Q=12, K=13. Suit powers: ♠ Iron, ♣ Salt, ♥ Fire, ♦ Silver.
- **Enemies (in row):** effective value = base value + 2 per festering token.
- **Rituals (Aces):** Last Rites — clear all festering from the whole row, no damage, discard the Ace.
- **Omens (Jokers):** reorder top 5 of deck; never enter hand.
- **Combos:** exactly 2 cards. Same suit → that suit power fires once at the summed value. Same rank,
  different suits → one suit power of your choice. No Aces in combos.
- **Immunity:** an enemy suppresses the suit power of a card matching its own suit (damage still lands).
- **Festering vs Splash:** festering (+2/token to value, cleared by Ritual/Salt) is tracked
  **separately** from splash damage (Fire; 2 total = instant destroy). They never interact.
- **The Lich:** 20 HP, no festering, can't be Burned, Corruption adds 1 festering to every *other*
  enemy on its even turns (start of Suffer), +3 Stamina on death, row limit becomes 4 while alive.

### A3. Rulings — the PDF gaps, resolved

These are the decisions the engine will encode. Flagged so you can overrule any of them.

- **R1 — A Smite fires at most one suit power.** A single card = one suit. A same-suit combo = that
  one suit's power, fired **once** (per the PDF's `6♥+9♥=15, Hearts fires once` example). A same-rank
  combo = one chosen power. **Consequence:** Iron's chain-flip and Silver's draw can *never* both
  trigger from one Smite, so there is no ordering conflict between them. Good.
- **R2 — Resolution order inside ACT (Smite):** (1) compute attack value, (2) apply Immunity check,
  (3) resolve kill/survive on the target, (4) if killed, place nothing / if survived, add 1 festering,
  (5) fire the suit power (Iron chain-flip / Salt / Fire splash / Silver draw), (6) resolve any deaths
  caused by the power (Fire splash reaching 2), (7) Iron chain-flip resolves a full mini-Flip. Deaths
  from splash are checked immediately when splash is applied.
- **R3 — Iron chain-flip is a real Flip.** It can reveal an enemy (stays for *this* turn's Suffer), a
  King/Warlord, the Lich (enters as 4th), an Ace (to hand), or a Joker (fire Omen, skip this turn's
  Suffer). It consumes next turn's FLIP step. Fires at most once per turn.
- **R4 — Win is checked after every phase**, not only at end of turn. If your ACT kills the last
  enemy and the deck is already empty, you win immediately (Suffer would hit 0 survivors anyway).
- **R5 — Loss is `legalActions(state)` being empty** at the point a decision is required, in addition
  to Stamina 0. This directly encodes PDF loss conditions #2 and #3. A Ritual counts as a legal escape
  **only if** it would clear ≥1 festering token; a do-nothing Ritual is not listed as an escape when
  the board has no festering (PDF is explicit about this).
- **R6 — Lich Corruption counter** is per-Lich, incremented at the start of each of the Lich's turns
  it has spent in the row; Corruption fires at the start of Suffer on even counts (2nd, 4th, …). It
  never affects the Lich itself.
- **R7 — Mid-turn Ace draws** (from Silver or Iron chain-flip) go to hand; if hand > 5 after ACT, the
  discard-down-to-5 happens at REFILL and Aces may be discarded if you choose.
- **R8 — Joker Suffer-skip only when revealed during FLIP or an Iron chain-flip.** Jokers revealed by
  Silver's draw or by REFILL fire the Omen but do **not** skip Suffer.
- **R9 — Empty-deck endgame:** FLIP is skipped; ACT/SUFFER/REFILL continue; REFILL draws whatever is
  left (may hold < 5). Rest legality still respects the "deck empty AND < 2 non-Ace cards" clause.
- **R10 — Rest legality:** illegal if row is full (3, or 4 with Lich) OR (deck empty AND hand has < 2
  non-Ace cards). Otherwise legal.

### A4. Optional balance variants (OFF by default, toggle in settings, test in the simulator)

These are *not* in v1; they're candidates the sim harness (Phase 4) will evaluate against the
Gold/Silver/Bronze target distribution before we'd ever enable one.

- **V1 — Easy/Normal/Hard:** starting Stamina 12 / 10 / 8.
- **V2 — Mercy Refill:** on a turn you took no action but couldn't (rare), draw 1 free.
- **V3 — Lich telegraph:** reveal that the Lich is in the bottom third (already implied) *and* show
  how deep once ~5 cards remain. Pure UX, no rules change.
- **V4 — Combo of 3** for a higher-difficulty mode (PDF forbids it in v1).

Guardrail: no variant ships until the simulator shows the intended difficulty curve.

---

## Part B — Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript | Type-safe engine, one language client-side |
| Build | Vite | Fast, first-class PWA plugin, static output |
| UI | React 18 | Real interactive state (selection, targeting, reorder modals) |
| Engine state → UI | External pure module + Zustand (or useReducer) | Engine stays outside React; store just holds current `GameState` and dispatches `apply()` |
| Tests | Vitest | Same toolchain, fast, property tests via fast-check |
| Animation | Framer Motion (MIT) | Card movement, damage numbers; degrade gracefully on mobile |
| PWA | vite-plugin-pwa (Workbox) | Offline + installable, trivial since 100% client-side |
| Lint/format | ESLint + Prettier | — |
| CI | GitHub Actions | Run tests + build on push |
| Hosting | Cloudflare Pages or GitHub Pages | Free static hosting |

**Engine ↔ React boundary (critical):** React never mutates game state. It calls
`apply(state, action)` from the pure engine, stores the returned new state, and re-renders. This
preserves every benefit of the pure core (testability, replay, sim).

```
src/
  engine/            # pure, zero DOM/React
    types.ts         # GameState, Card, Enemy, Action, Phase, EventLog
    rng.ts           # seeded PRNG (mulberry32) + seeded shuffle
    setup.ts         # new game from seed (pick Lich, bury it, deal 5)
    turn.ts          # phase machine: flip/suffer/refill
    actions.ts       # legalActions(), apply(state, action) -> {state, events}
    rules/
      smite.ts combo.ts immunity.ts festering.ts splash.ts
      suits.ts        # iron/salt/fire/silver
      ritual.ts omen.ts lich.ts warlord.ts rest.ts burn.ts
    status.ts        # inProgress | won(tier) | lost(reason)
    *.test.ts        # PDF examples + every ruling above
  sim/
    run.ts           # headless: N seeded games -> win% + tier histogram
    strategies.ts    # random, greedy, heuristic bots
  ui/
    App.tsx store.ts
    components/ Row.tsx Hand.tsx Card.tsx StatusBar.tsx
               ReorderModal.tsx TargetPicker.tsx GameOver.tsx
    theme/ (fonts, colors, textures)
  pwa/ manifest, icons, service worker config
```

---

## Part C — Assets (open source / CC only)

Everything below is free to use; license noted. We attribute in an `ASSETS.md` + in-app credits.

### C1. Cards
- **Primary approach — CSS/SVG-rendered cards.** For a themed gothic game, render rank+suit
  ourselves (styled `<div>`/SVG). Scales perfectly on any screen, tiny payload, fully themeable,
  no license issues. This is the recommended default.
- **Fallback / classic look:** David Bellot **SVG-cards** (LGPL) or **Kenney Playing Cards Pack**
  (CC0) if we want photoreal faces. Kenney also gives us card backs.

### C2. Fonts (all Google Fonts, OFL)
- **Title (blackletter):** UnifrakturCook or Pirata One — matches the PDF's "Gravedigger" logo.
- **Body serif:** EB Garamond or Cormorant / Cormorant SC — matches the PDF's elegant serif + small caps.
- Self-host the woff2 files so the PWA works offline.

### C3. Icons — thematic
- **game-icons.net** (CC BY 3.0): skull, tombstone, gravedigger, fire/flame (Fire), salt/crystals
  (Salt), anvil/ingot (Iron), silver coin (Silver), moon phases, potion, crossed-swords (Smite).
  Perfect gothic aesthetic, all SVG. This covers essentially every icon we need.
- Suit pips: Unicode/SVG, styled.

### C4. Audio (optional, Phase 9)
- **Kenney audio packs** (CC0) and **freesound.org** (check per-file CC license) for card flips,
  a low hit, a death "crunch", ambient graveyard wind. Everything mutable; off by default on mobile.

### C5. Textures / background
- CC0 dark parchment / stone textures (e.g., from Kenney or public-domain sources), used subtly
  behind the felt so it reads gothic, not casino.

**Asset pipeline:** SVGs inlined or sprited; fonts subset + woff2; images compressed; all bundled
by Vite so the PWA caches them for offline. Keep total initial payload small for mobile.

---

## Part D — Mobile-friendliness

- **Portrait-first, thumb-first.** Hand fixed to the bottom third (reachable), enemy row in the
  upper-middle, status bar (Stamina, deck count, turn, Lich HP) pinned top.
- **Touch model:** tap a card to select (highlight); tap a second card to attempt a combo; tap an
  enemy to target/confirm; a bottom action bar for Rest/Burn/Ritual/Cancel. Optional drag as an
  enhancement, never required. Big hit targets (≥44px), generous spacing.
- **Reorder interactions** (Omen top-5, Salt/Trickster top-2): a dedicated modal with tap-to-swap
  or long-press drag — designed for touch first.
- **Responsive:** CSS clamp()/container queries; scale card size to viewport; landscape supported
  but portrait is primary. Respect `env(safe-area-inset-*)` for notches/home indicators.
- **PWA:** installable to home screen, full-screen, **offline-capable** (all logic + assets are
  local — no network needed after first load). Add manifest, maskable icons, service worker.
- **Performance:** keep animations GPU-cheap; `prefers-reduced-motion` respected; no layout thrash.
- **No backend, no accounts.** Saves live in `localStorage`/IndexedDB.

---

## Part E — Roadmap (phased, each phase has a hard done-criterion)

### Phase 0 — Foundations (0.5 day)
Scaffold Vite + React + TS + Vitest + ESLint/Prettier. Commit the ruleset (Part A) as
`engine/RULES.md`. CI runs tests + build.
**Done:** `npm run dev`, `npm test`, `npm run build` all work on an empty shell.

### Phase 1 — Engine core (1–2 days)
Types, seeded RNG + shuffle, `setup(seed)`, the FLIP→ACT→SUFFER→REFILL loop for the *simple* actions
(Smite as raw value, Rest, Burn), win/loss, victory tiers. No suit powers yet.
**Done:** a headless script plays a full random game to a win/loss; core tests green.

### Phase 2 — Full rules (2–3 days)
Suit powers (Iron/Salt/Fire/Silver), Immunity, combos, festering vs splash, Ritual, Omen, hand-limit
discard, all of R1–R10.
**Done:** every PDF worked example + every ruling is a passing test.

### Phase 3 — The Lich & Warlords (1–2 days)
20 HP, no-fester, Corruption on even turns, row-limit 4, +3 on death, Warlords as value-13 enemies.
**Done:** scripted Lich scenarios (Corruption timing, splash-to-HP, defeat bonus) pass.

### Phase 4 — Balance simulator (1 day)
`sim/` runs N seeded games with random + greedy + heuristic bots; reports win% and Gold/Silver/Bronze
histogram. Use it to sanity-check v1 difficulty and evaluate variants V1–V4.
**Done:** a report table; confirmation v1 isn't trivially winnable or impossible; rulings validated.

### Phase 5 — React UI skeleton (2 days)
Render `GameState`: status bar, enemy row, hand, action bar, event log. Click to dispatch actions.
Ugly but fully playable in a desktop browser.
**Done:** a human can play a complete game start to finish in the browser, mouse-only.

### Phase 6 — Interaction polish (2 days) ← **MVP cut line**
Card selection, combo selection, target picking, reorder modals (Omen/Salt), confirm/cancel,
legal-move highlighting, undo-last-*within-decision* (not across Suffer). Clear error states.
**Done:** every legal action is reachable via intuitive clicks/taps; illegal ones are disabled with a reason.

### Phase 7 — Assets & theming (2 days)
Fonts, game-icons, CSS-rendered gothic cards, dark palette, textures, layout refinement. Match the
PDF's mood.
**Done:** it *looks* like the Gravedigger PDF; all assets local + attributed in `ASSETS.md`.

### Phase 8 — Mobile & PWA (2 days)
Responsive portrait layout, touch model, safe-area, manifest + service worker + offline caching,
installable. Test on real phone.
**Done:** installs to a phone home screen, plays fully offline, comfortable one-thumb play.

### Phase 9 — Juice (1–2 days, optional)
Framer Motion card movement, damage numbers, death effects, optional sound, haptics on mobile,
`prefers-reduced-motion` path.
**Done:** actions feel tactile; motion can be disabled.

### Phase 10 — Persistence & meta (1 day)
Auto-save to IndexedDB (resume in progress), seed entry/sharing ("play this exact graveyard"),
win/loss stats and best victory tier, settings (variants, sound, motion).
**Done:** close the tab mid-game and resume; paste a seed to replay a specific deck.

### Phase 11 — QA & a11y (1–2 days)
Cross-device/browser testing, keyboard navigation, screen-reader labels on cards/actions, color
contrast, colorblind-safe suit differentiation (shape + color, not color alone), fuzz the engine
(property tests: Stamina∈[0,10], row≤3/4, tokens/splash≥0, no illegal state reachable).
**Done:** no reachable illegal state in 100k fuzzed games; a11y checklist passes.

### Phase 12 — Ship (0.5 day)
Deploy to Cloudflare/GitHub Pages via CI, in-app rules/tutorial (adapt the PDF), credits page, README.
**Done:** public URL, installable PWA, tutorial in place.

**Rough total:** ~3–4 focused weeks to a polished, mobile PWA; ~1.5 weeks to the MVP cut line (Phase 6).

---

## Part F — Testing strategy (runs continuously, not a phase)
- **Unit:** every rule + every PDF example + R1–R10.
- **Scenario:** hand-authored tricky turns (Iron chain into Joker; Fire multi-kill; Lich Corruption
  on turn 4; loss-by-no-legal-action).
- **Property/fuzz (fast-check):** invariants above hold across random play.
- **Sim:** difficulty curve stays in target band across builds (regression guard on balance).
- **Golden replays:** record seed + action list for a full game; assert identical outcome after refactors.

## Part G — Definition of done (v1.0)
Fully playable start-to-finish on desktop and mobile · installable offline PWA · engine provably
faithful to Canonical Rules v1 · all assets open-source and attributed · seed sharing + resume ·
in-app tutorial · deployed to a public URL.

## Part H — Open questions for you
1. Title font — blackletter **Pirata One** vs the heavier **UnifrakturCook** (I'll mock both).
2. Card look — **CSS-rendered gothic** (recommended) vs **classic photoreal deck**.
3. Ship the difficulty variants (V1–V4) in 1.0, or lock to faithful v1 first and add later?
4. Any rulings in A3 you want to overrule before I encode them?
