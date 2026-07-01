# Gravedigger — Canonical Rules v1

<!-- DEV NOTE (not rendered in-app): this file is the single source of truth for the engine AND
the in-app "How to Play" screen. UI rules text is generated from these sections so the game can
never drift from the engine. Keep it player-readable. -->

*A cursed cemetery. The dead keep rising. You are the only thing standing between them and the
living — armed with iron, salt, fire, and silver. Work fast. The longer they fester, the harder
they fall.*

## The deck
A standard 52-card deck **plus both Jokers** (54 cards). Every card has a role depending on where
it appears:
- **Tools** — cards in your hand, played to fight enemies. Discarded after use.
- **Enemies** — cards flipped from the deck into the Graveyard Row.
- **Rituals** — Aces, in your hand.
- **Omens** — Jokers, which never enter your hand.

## Tools (cards in hand)
Value: 2–10 = face value, Jack = 11, Queen = 12, King = 13. Each suit has a power:
- ♠ **Iron — Break Through:** after a kill, immediately flip the next card (once per turn).
- ♣ **Salt — Suppress:** remove one festering token; or, if none exist anywhere, reorder the top 2 of the deck.
- ♥ **Fire — Splash:** deal 2 splash damage to every *other* enemy in the row.
- ♦ **Silver — Precision:** if your Smite kills, draw 2 cards immediately.

## Enemies (cards in the row)
Effective value = base value + 2 per festering token.
| Rank | Name | Value |
|---|---|---|
| 2–6 | Shambler | face |
| 7–9 | Revenant | face |
| 10 | Wight | 10 |
| J | Haunt | 11 |
| Q | Banshee | 12 |
| K (×3) | Warlord | 13 |
| K (×1) | The Lich | boss, 20 HP |

## Your turn: Flip → Act → Suffer → Refill
1. **Flip** the top card. Number/J/Q → enemy. Non-Lich King → Warlord. Lich → 4th enemy.
   Ace → your hand as a Ritual. Joker → fire its Omen, skip Act & Suffer, go to Refill.
   (Deck empty → skip Flip.)
2. **Act** — choose one:
   - **Smite:** play one card (or a legal 2-card combo) at a single enemy. Value ≥ enemy's
     effective value = killed. Less = it survives and gains a festering token. Then the suit
     power fires (unless Immunity).
   - **Ritual (Ace):** Last Rites — clear all festering from the whole row. No damage.
   - **Rest:** recover 2 Stamina (max 10). Illegal if the row is full, or if the deck is empty
     and you hold fewer than 2 non-Ace cards.
   - **Burn:** discard 2 non-Ace cards to remove one enemy (not the Lich). No powers fire.
3. **Suffer:** lose 1 Stamina for every enemy that survived this turn.
4. **Refill:** draw up to 5 (discard down to 5 first if mid-turn draws overfilled).

## Combos
Two cards played as one Smite (values add). **Same suit:** that power fires once. **Same rank,
different suits:** one power of your choice. No Aces, no 3-card combos, no different-suit-and-rank.

## Immunity
An enemy suppresses the suit power of a card matching its own suit. The damage still lands — only
the power is suppressed.

## Festering vs. Splash (tracked separately)
- **Festering:** +2 to the enemy's value per token. Cleared by a Ritual or Salt. No cap.
- **Splash (Fire):** 2 total splash damage instantly destroys an enemy. Persists between turns.
  Does not interact with festering.

## The Lich
20 HP, chipped down across turns. Cannot be Burned. Cannot fester. On every even turn it has been
in the row, **Corruption** adds 1 festering token to every *other* enemy (at the start of Suffer).
Splash damage counts toward its 20 HP. Defeating it: +3 Stamina, row limit returns to 3.

## Rituals (Aces) & Omens (Jokers)
- **Ritual:** played instead of Smiting; clears all festering from the row; Suffer still happens.
- **Omen (The Trickster):** reorder the top 5 of the deck, then the Joker is discarded. Skips
  Suffer **only** when revealed during Flip or an Iron chain-flip — not via Silver or Refill.

## Winning & losing
**Win** when the deck is empty and the row is clear. **Lose** if Stamina hits 0, or if you have no
legal action while enemies remain (stalling is not an escape; a do-nothing Ritual doesn't count).

**Victory tiers by remaining Stamina:** 8–10 Gold (Master Gravedigger) · 5–7 Silver (Seasoned
Hand) · 1–4 Bronze (Barely Standing).
