import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as RKeyEvent,
  type TouchEvent as RTouchEvent,
} from "react";
import { marked } from "marked";
import "./styles.css";
import rulesMarkdown from "../engine/RULES.md?raw";
import {
  newGame,
  apply,
  isLegal,
  restLegal,
  effectiveValue,
  SUIT_SYMBOL,
  SUIT_NAME,
  isAce,
  isJoker,
} from "../engine";
import type { GameState, Enemy, Card, Action, Suit } from "../engine";
import { InstallPrompt } from "./Install";
import {
  saveGame,
  loadGame,
  clearGame,
  loadStats,
  recordResult,
  seedFromUrl,
  decksFromUrl,
  clearSeedFromUrl,
  shareLink,
  parseSeedInput,
  MAX_DECKS,
  type Stats,
} from "./persist";

const DIFFICULTY: { name: string; decks: number }[] = [
  { name: "Restless", decks: 1 },
  { name: "Cursed", decks: 2 },
  { name: "Haunted", decks: 3 },
  { name: "Damned", decks: 4 },
  { name: "Impossible", decks: 5 },
];

import {
  loadSettings,
  saveSettings,
  setSound,
  setHaptics,
  playCue,
  buzz,
  denied,
  type Settings,
} from "./fx";

/** Count enemies laid to rest / destroyed in a transition (their cards move to discard). */
function countKills(prev: GameState, next: GameState): number {
  const wasEnemy = new Set(prev.row.map((e) => e.id));
  const before = new Set(prev.discard.map((c) => c.id));
  return next.discard.filter((c) => wasEnemy.has(c.id) && !before.has(c.id)).length;
}

/** Sound + haptic feedback for what a move produced. */
function fireFeedback(prev: GameState, next: GameState, action: Action): void {
  if (next.status.kind === "won") {
    playCue("win");
    buzz([0, 40, 60, 40, 120]);
    return;
  }
  if (next.status.kind === "lost") {
    playCue("lose");
    buzz(220);
    return;
  }
  const kills = countKills(prev, next);
  if (action.type === "ritual") playCue("ritual");
  else if (action.type === "burn") {
    playCue("burn");
    buzz(30);
  }
  if (kills > 0) {
    playCue("kill");
    buzz(25);
  } else if (action.type === "smite") {
    playCue("fester");
    buzz(12);
  }
  if (next.pending?.kind === "reorder" && next.pending.source === "omen") playCue("omen");
  if (next.stamina < prev.stamina) playCue("suffer");
}

/** Resume a saved game, honor a ?seed= link, or start fresh — in that priority. */
function initialState(): GameState {
  const urlSeed = seedFromUrl();
  if (urlSeed !== null) {
    const decks = decksFromUrl() ?? 1;
    clearSeedFromUrl();
    return newGame(urlSeed, decks);
  }
  return loadGame() ?? newGame(Math.floor(Math.random() * 1e9), 1);
}

const RULES_HTML = marked.parse(rulesMarkdown) as string;

const RED_SUITS = new Set(["H", "D"]);
const SUIT_FULL: Record<string, string> = { S: "Spades", C: "Clubs", H: "Hearts", D: "Diamonds" };
const RANK_FULL: Record<number, string> = {
  1: "Ace",
  11: "Jack",
  12: "Queen",
  13: "King",
};

function rankStr(c: Card): string {
  if (isJoker(c)) return "★";
  const r = c.rank!;
  return r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r);
}

/** Fire a click when Enter/Space is pressed on a non-button element. */
const onActivate = (fn: () => void) => (e: RKeyEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

function cardAria(c: Card): string {
  if (isJoker(c)) return "Joker — an Omen";
  const rank = RANK_FULL[c.rank!] ?? String(c.rank);
  const suit = SUIT_FULL[c.suit!];
  if (isAce(c)) return `${rank} of ${suit}, a Ritual card`;
  return `${rank} of ${suit}, a ${SUIT_NAME[c.suit!]} tool`;
}

function enemyAria(e: Enemy): string {
  if (e.role === "lich") return `The Lich, ${e.hp} hit points remaining`;
  const name = e.role === "warlord" ? "Warlord" : enemyLabel(e.base);
  const parts = [`${name}, value ${effectiveValue(e)}`];
  if (e.festering > 0) parts.push(`${e.festering} festering`);
  if (e.splash > 0) parts.push(`${e.splash} splash damage`);
  return parts.join(", ");
}

export function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [selected, setSelected] = useState<string[]>([]);
  const [burnArmed, setBurnArmed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [comboSuit, setComboSuit] = useState<Suit | null>(null);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  // Push settings into the fx runtime whenever they change (and on first mount).
  useEffect(() => {
    setSound(settings.sound);
    setHaptics(settings.haptics);
  }, [settings]);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettingsState((cur) => {
      const next = { ...cur, ...patch };
      saveSettings(next);
      return next;
    });
  };

  // Flash the Stamina stat when it changes (down = red, up = green).
  const [staminaFlash, setStaminaFlash] = useState<"" | "up" | "down">("");
  const prevStamina = useRef(state.stamina);
  useEffect(() => {
    if (state.stamina !== prevStamina.current) {
      setStaminaFlash(state.stamina < prevStamina.current ? "down" : "up");
      prevStamina.current = state.stamina;
      const t = setTimeout(() => setStaminaFlash(""), 550);
      return () => clearTimeout(t);
    }
  }, [state.stamina]);

  const clearSelection = () => {
    setSelected([]);
    setBurnArmed(false);
    setComboSuit(null);
  };

  // Apply a move, then persist: autosave while playing, record + clear the slot when it ends.
  const commit = (next: GameState) => {
    setState(next);
    clearSelection();
    if (next.status.kind === "playing") {
      saveGame(next);
    } else {
      clearGame();
      setStats(recordResult(next.status, next.decks));
    }
  };

  const dispatch = (action: Action) => {
    const next = apply(state, action);
    fireFeedback(state, next, action);
    commit(next);
  };

  const restart = (newSeed?: number, decks?: number) => {
    const g = newGame(newSeed ?? Math.floor(Math.random() * 1e9), decks ?? state.decks);
    setState(g);
    clearSelection();
    saveGame(g);
    setMenuOpen(false);
  };

  const toggleCard = (id: string) => {
    playCue("select");
    buzz(8);
    setComboSuit(null); // any change of selection resets the chosen combo power
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 2 ? [cur[1], id] : [...cur, id],
    );
  };

  const selectedCards = selected
    .map((id) => state.hand.find((c) => c.id === id))
    .filter((c): c is Card => !!c);
  const attackValue = selectedCards.reduce((n, c) => n + (isAce(c) ? 0 : (c.rank ?? 0)), 0);
  const aceSelected = selectedCards.find(isAce);

  // Same-rank / different-suit combo: the player picks which suit power fires.
  const sameRankCombo =
    selectedCards.length === 2 &&
    selectedCards[0].rank === selectedCards[1].rank &&
    selectedCards[0].suit !== selectedCards[1].suit;
  const firingSuit: Suit | undefined =
    selectedCards.length === 0
      ? undefined
      : sameRankCombo
        ? (comboSuit ?? selectedCards[0].suit)
        : selectedCards[0].suit;

  const onEnemy = (e: Enemy) => {
    if (state.status.kind !== "playing" || state.pending) return;
    if (burnArmed) {
      if (selected.length === 2 && isLegal(state, { type: "burn", cardIds: selected, targetId: e.id })) {
        dispatch({ type: "burn", cardIds: selected, targetId: e.id });
      } else {
        denied(); // need exactly 2 non-Ace cards, and not the Lich
      }
      return;
    }
    if (selected.length === 0) {
      denied(); // nothing selected to strike with
      return;
    }
    const action: Action = { type: "smite", cardIds: selected, targetId: e.id, chosenSuit: firingSuit };
    if (isLegal(state, action)) dispatch(action);
    else denied();
  };

  const lich = state.row.find((e) => e.role === "lich");
  const playing = state.status.kind === "playing";

  const hint = useMemo(() => {
    if (!playing) return "";
    if (state.pending) return "An Omen stirs the deck — confirm to continue.";
    if (burnArmed) return "Burn armed — pick 2 cards, then tap an enemy to remove it.";
    if (selected.length === 0) return "Tap a card (or two for a combo), then tap an enemy to Smite.";
    if (aceSelected && selected.length === 1) return "Ace selected — play it as a Ritual, or tap an enemy.";
    return `Attack value ${attackValue} — tap an enemy to strike.`;
  }, [playing, state.pending, burnArmed, selected, aceSelected, attackValue]);

  return (
    <div className="app">
      <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
        ≡
      </button>
      <button className="help-btn" onClick={() => setHelpOpen(true)} aria-label="How to play">
        ?
      </button>
      <div className="title">Gravedigger</div>
      <div className="subtitle">A Solitaire Card Game</div>

      <InstallPrompt />

      <StatusBar state={state} lich={lich} staminaFlash={staminaFlash} />

      <div className="hdr">The Graveyard Row</div>
      <div className="row">
        {state.row.length === 0 && <div className="empty-row">The row is still. For now.</div>}
        {state.row.map((e) => (
          <EnemyCard
            key={e.id}
            enemy={e}
            armed={selected.length > 0 || burnArmed}
            killable={
              burnArmed
                ? e.role !== "lich" && selected.length === 2
                : selected.length > 0 && e.role !== "lich" && attackValue >= effectiveValue(e)
            }
            onClick={() => onEnemy(e)}
          />
        ))}
      </div>

      <div className="spacer" />

      <div className="hint">{hint}</div>

      {sameRankCombo && (
        <div className="combo-choice">
          <span className="combo-label">Power:</span>
          {selectedCards.map((c) => (
            <button
              key={c.suit}
              className={"chip" + (firingSuit === c.suit ? " on" : "")}
              onClick={() => setComboSuit(c.suit!)}
            >
              {SUIT_SYMBOL[c.suit!]} {SUIT_NAME[c.suit!]}
            </button>
          ))}
        </div>
      )}

      <div className="hdr">Your Hand</div>
      <div className="hand">
        {state.hand.map((c) => (
          <HandCard
            key={c.id}
            card={c}
            selected={selected.includes(c.id)}
            burn={burnArmed}
            onClick={() => toggleCard(c.id)}
          />
        ))}
      </div>

      <div className="actions">
        <button
          className="btn"
          disabled={!playing || !!state.pending || !restLegal(state)}
          onClick={() => dispatch({ type: "rest" })}
        >
          Rest
        </button>
        <button
          className="btn"
          disabled={
            !playing ||
            !!state.pending ||
            !aceSelected ||
            !isLegal(state, { type: "ritual", cardId: aceSelected?.id ?? "" })
          }
          onClick={() => aceSelected && dispatch({ type: "ritual", cardId: aceSelected.id })}
        >
          Ritual
        </button>
        <button
          className={"btn" + (burnArmed ? " armed" : "")}
          disabled={!playing || !!state.pending}
          onClick={() => setBurnArmed((b) => !b)}
        >
          {burnArmed ? "Burning…" : "Burn"}
        </button>
        <button className="btn" onClick={() => restart()}>
          New Game
        </button>
      </div>

      <ChroniclePanel log={state.log} />

      {state.pending?.kind === "reorder" && (
        <ReorderModal
          state={state}
          onConfirm={(order) => dispatch({ type: "reorder", newTopOrder: order })}
        />
      )}
      {state.pending?.kind === "salt-remove" && (
        <SaltRemoveModal
          state={state}
          onPick={(targetId) => dispatch({ type: "salt-remove", targetId })}
        />
      )}
      {state.pending?.kind === "discard" && (
        <DiscardModal
          state={state}
          downTo={state.pending.downTo}
          onConfirm={(ids) => dispatch({ type: "discard", cardIds: ids })}
        />
      )}
      {!playing && <GameOver state={state} onRestart={() => restart()} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {menuOpen && (
        <MenuModal
          state={state}
          stats={stats}
          settings={settings}
          onChangeSettings={updateSettings}
          onClose={() => setMenuOpen(false)}
          onNewGame={() => restart()}
          onPlaySeed={(seed) => restart(seed)}
          onPlayDifficulty={(decks) => restart(undefined, decks)}
        />
      )}
    </div>
  );
}

function MenuModal({
  state,
  stats,
  settings,
  onChangeSettings,
  onClose,
  onNewGame,
  onPlaySeed,
  onPlayDifficulty,
}: {
  state: GameState;
  stats: Stats;
  settings: Settings;
  onChangeSettings: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onNewGame: () => void;
  onPlaySeed: (seed: number) => void;
  onPlayDifficulty: (decks: number) => void;
}) {
  const [seedInput, setSeedInput] = useState("");
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink(state.seed, state.decks));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const start = () => {
    const seed = parseSeedInput(seedInput);
    if (seed !== null) onPlaySeed(seed);
  };

  const winPct = stats.played ? Math.round((100 * stats.wins) / stats.played) : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal menu" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>The Sexton's Ledger</h2>

        <div className="menu-section">
          <div className="menu-label">This graveyard's seed</div>
          <div className="seed-row">
            <code className="seed-val">{state.seed >>> 0}</code>
            <button className="btn ghost" onClick={copyLink}>
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        <div className="menu-section">
          <div className="menu-label">Raise a specific graveyard</div>
          <div className="seed-row">
            <input
              className="seed-input"
              placeholder="a number or a word…"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
            />
            <button className="btn ghost" disabled={!seedInput.trim()} onClick={start}>
              Play
            </button>
          </div>
        </div>

        <div className="menu-section">
          <div className="menu-label">Difficulty — win a level to unlock the next</div>
          <div className="difficulty">
            {DIFFICULTY.map((d) => {
              const locked = d.decks > stats.unlocked;
              const current = d.decks === state.decks;
              return (
                <button
                  key={d.decks}
                  className={"level" + (current ? " current" : "") + (locked ? " locked" : "")}
                  disabled={locked}
                  onClick={() => onPlayDifficulty(d.decks)}
                  title={`${d.decks} deck${d.decks > 1 ? "s" : ""}`}
                >
                  <span className="level-name">
                    {locked ? "🔒 " : ""}
                    {d.name}
                  </span>
                  <span className="level-decks">
                    {d.decks} deck{d.decks > 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {stats.unlocked < MAX_DECKS && (
            <div className="unlock-hint">
              Win on {DIFFICULTY[stats.unlocked - 1].name} to unlock{" "}
              {DIFFICULTY[stats.unlocked].name}.
            </div>
          )}
        </div>

        <div className="menu-section">
          <div className="menu-label">Atmosphere</div>
          <div className="toggle-row">
            <Toggle
              label="Sound"
              on={settings.sound}
              onClick={() => onChangeSettings({ sound: !settings.sound })}
            />
            <Toggle
              label="Haptics"
              on={settings.haptics}
              onClick={() => onChangeSettings({ haptics: !settings.haptics })}
            />
          </div>
        </div>

        <div className="menu-section">
          <div className="menu-label">Your watch</div>
          <div className="stats-grid">
            <Stat k="Played" v={stats.played} />
            <Stat k="Won" v={`${stats.wins} (${winPct}%)`} />
            <Stat k="Streak" v={`${stats.streak} / ${stats.bestStreak}`} />
            <Stat k="Gold" v={stats.gold} />
            <Stat k="Silver" v={stats.silver} />
            <Stat k="Bronze" v={stats.bronze} />
          </div>
        </div>

        <div className="install-actions">
          <button className="btn" onClick={onNewGame}>
            New Game
          </button>
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="mini-stat">
      <div className="mini-k">{k}</div>
      <div className="mini-v">{v}</div>
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={"toggle" + (on ? " on" : "")} onClick={onClick} role="switch" aria-checked={on}>
      <span className="toggle-label">{label}</span>
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal help" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <div className="help-body" dangerouslySetInnerHTML={{ __html: RULES_HTML }} />
        <button className="btn" onClick={onClose} style={{ marginTop: 14 }}>
          Close
        </button>
      </div>
    </div>
  );
}

function ChroniclePanel({ log }: { log: GameState["log"] }) {
  const [page, setPage] = useState(0); // 0 = Chronicle, 1 = Quick Reference
  const startX = useRef<number | null>(null);

  const onTouchStart = (e: RTouchEvent) => {
    startX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: RTouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > 40) setPage(dx < 0 ? 1 : 0);
  };

  return (
    <>
      <div className="hdr chronicle-hdr" id="chronicle-label">
        {page === 0 ? "Chronicle" : "Quick Reference"}
        <span className="swipe-hint">swipe ⟷</span>
      </div>
      <div className="panel-swipe" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {page === 0 ? (
          <div className="log" role="log" aria-live="polite" aria-labelledby="chronicle-label">
            {log.slice(-7).map((ev, i) => (
              <div className="line" key={i}>
                {ev.text}
              </div>
            ))}
          </div>
        ) : (
          <QuickRef />
        )}
      </div>
      <div className="dots">
        <button
          className={"dot" + (page === 0 ? " on" : "")}
          onClick={() => setPage(0)}
          aria-label="Show Chronicle"
        />
        <button
          className={"dot" + (page === 1 ? " on" : "")}
          onClick={() => setPage(1)}
          aria-label="Show Quick Reference"
        />
      </div>
    </>
  );
}

function QuickRef() {
  const rows: [string, string][] = [
    ["Turn", "Flip → Act → Suffer → Refill"],
    ["Act", "Smite · Ritual · Rest · Burn"],
    ["Smite", "meet/beat value = kill; else it festers"],
    ["♠ Iron", "on kill, flip the next card now"],
    ["♣ Salt", "clear one festering token"],
    ["♥ Fire", "2 splash to every other enemy"],
    ["♦ Silver", "on kill, draw 2 cards"],
    ["Combo", "2 cards — same suit, or same rank"],
    ["Ace", "Ritual: clear all festering"],
    ["Joker", "Omen: peek & reorder the deck"],
    ["Burn", "discard 2 cards to remove an enemy"],
    ["Win / Lose", "clear deck & row / Stamina hits 0"],
  ];
  return (
    <div className="quickref">
      {rows.map(([k, v]) => (
        <div className="qr-row" key={k}>
          <span className="qr-k">{k}</span>
          <span className="qr-v">{v}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBar({
  state,
  lich,
  staminaFlash,
}: {
  state: GameState;
  lich?: Enemy;
  staminaFlash: "" | "up" | "down";
}) {
  return (
    <div className="status">
      <div className={"stat stamina" + (staminaFlash ? " flash-" + staminaFlash : "")}>
        <div className="k">Stamina</div>
        <div className="v">{state.stamina}</div>
      </div>
      <div className="stat">
        <div className="k">Deck</div>
        <div className="v">{state.deck.length}</div>
      </div>
      <div className="stat">
        <div className="k">Turn</div>
        <div className="v">{state.turn}</div>
      </div>
      <div className="stat">
        <div className="k">Row</div>
        <div className="v">{state.row.length}</div>
      </div>
      {lich && (
        <div className="stat lich">
          <div className="k">The Lich</div>
          <div className="v">{lich.hp} HP</div>
        </div>
      )}
    </div>
  );
}

function EnemyCard({
  enemy,
  armed,
  killable,
  onClick,
}: {
  enemy: Enemy;
  armed: boolean;
  killable: boolean;
  onClick: () => void;
}) {
  const name =
    enemy.role === "lich"
      ? "The Lich"
      : enemy.role === "warlord"
        ? "Warlord"
        : enemyLabel(enemy.base);
  const cls =
    "enemy" +
    (enemy.role === "lich" ? " lich" : "") +
    (armed && killable ? " killable" : "") +
    (armed && !killable ? " tough" : "");
  const value = enemy.role === "lich" ? enemy.hp : effectiveValue(enemy);
  return (
    <div
      className={cls}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(onClick)}
      aria-label={enemyAria(enemy)}
    >
      <div className="name">{name}</div>
      <MiniCard card={enemy.card} />
      <div className="val">
        {value}
        {enemy.role === "lich" ? <span className="val-hp"> HP</span> : null}
      </div>
      <div className="tokens">
        {enemy.festering > 0 && <span className="fester">✦{enemy.festering} </span>}
        {enemy.splash > 0 && <span className="splash">♨{enemy.splash}</span>}
      </div>
    </div>
  );
}

/** A small playing-card face — the actual card an enemy was flipped from. */
function MiniCard({ card }: { card: Card }) {
  const red = card.suit && RED_SUITS.has(card.suit);
  const sym = card.suit ? SUIT_SYMBOL[card.suit] : "★";
  return (
    <div className={"minicard" + (red ? " red" : "")} aria-hidden="true">
      <span className="mc-corner">{rankStr(card)}</span>
      <span className="mc-pip">{sym}</span>
    </div>
  );
}

function enemyLabel(base: number): string {
  if (base <= 6) return "Shambler";
  if (base <= 9) return "Revenant";
  if (base === 10) return "Wight";
  if (base === 11) return "Haunt";
  return "Banshee";
}

function HandCard({
  card,
  selected,
  burn = false,
  onClick,
}: {
  card: Card;
  selected: boolean;
  burn?: boolean;
  onClick: () => void;
}) {
  const joker = isJoker(card);
  const red = card.suit && RED_SUITS.has(card.suit);
  const sym = card.suit ? SUIT_SYMBOL[card.suit] : "";
  const cls =
    "card" +
    (red ? " red" : "") +
    (isAce(card) ? " ace" : "") +
    (joker ? " joker" : "") +
    (selected ? (burn ? " burning" : " selected") : "");
  return (
    <div
      className={cls}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={onActivate(onClick)}
      aria-label={cardAria(card)}
      aria-pressed={selected}
      title={card.suit ? `${SUIT_NAME[card.suit]} (${card.suit})` : "Joker — an Omen"}
    >
      {joker ? (
        <>
          <div className="r">✶</div>
          <div className="mid joker-face">☠</div>
          <div className="joker-tag">OMEN</div>
        </>
      ) : (
        <>
          <div className="r">{rankStr(card)}</div>
          <div className="mid">{sym}</div>
          <div className="s">{sym}</div>
        </>
      )}
    </div>
  );
}

function ReorderModal({
  state,
  onConfirm,
}: {
  state: GameState;
  onConfirm: (order: string[]) => void;
}) {
  const pending = state.pending!;
  const count = pending.kind === "reorder" ? pending.count : 0;
  const isSalt = pending.kind === "reorder" && pending.source === "salt-peek";
  const [order, setOrder] = useState<Card[]>(() => state.deck.slice(0, count));
  const [pick, setPick] = useState<number | null>(null);

  const tap = (i: number) => {
    if (pick === null) {
      setPick(i);
    } else if (pick === i) {
      setPick(null);
    } else {
      const next = order.slice();
      [next[pick], next[i]] = [next[i], next[pick]];
      setOrder(next);
      setPick(null);
    }
  };

  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{isSalt ? "Salt's Sight" : "The Trickster"}</h2>
        <p>
          These are the next cards to be flipped (left = top).{" "}
          {order.length > 1 ? "Tap two to swap them." : "Nothing to reorder."}
        </p>
        <div className="hand reorder" style={{ margin: "14px 0" }}>
          {order.map((c, i) => (
            <HandCard key={c.id} card={c} selected={pick === i} onClick={() => tap(i)} />
          ))}
        </div>
        <button className="btn" onClick={() => onConfirm(order.map((c) => c.id))}>
          Confirm order
        </button>
      </div>
    </div>
  );
}

function SaltRemoveModal({
  state,
  onPick,
}: {
  state: GameState;
  onPick: (targetId: string) => void;
}) {
  const festered = state.row.filter((e) => e.festering > 0);
  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>Salt</h2>
        <p>Choose an enemy to cleanse of one festering token.</p>
        <div className="row" style={{ margin: "14px 0" }}>
          {festered.map((e) => (
            <EnemyCard key={e.id} enemy={e} armed={false} killable={false} onClick={() => onPick(e.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DiscardModal({
  state,
  downTo,
  onConfirm,
}: {
  state: GameState;
  downTo: number;
  onConfirm: (ids: string[]) => void;
}) {
  const need = state.hand.length - downTo;
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id); // tap again to deselect
      if (cur.length < need) return [...cur, id];
      return [...cur.slice(1), id]; // at the limit: drop the oldest pick, select this one
    });
  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>Overflow</h2>
        <p>
          Your hand holds {state.hand.length}. Choose {need} card{need > 1 ? "s" : ""} to let fall.
        </p>
        <div className="hand" style={{ margin: "14px 0" }}>
          {state.hand.map((c) => (
            <HandCard key={c.id} card={c} selected={picked.includes(c.id)} onClick={() => toggle(c.id)} />
          ))}
        </div>
        <button className="btn" disabled={picked.length !== need} onClick={() => onConfirm(picked)}>
          Bury {picked.length}/{need}
        </button>
      </div>
    </div>
  );
}

function GameOver({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const s = state.status;
  const won = s.kind === "won";
  return (
    <div className="overlay">
      <div className="modal" role="dialog" aria-modal="true">
        <h2>{won ? "The Dead Rest" : "Overrun"}</h2>
        {won && s.kind === "won" ? (
          <>
            <p>The graveyard is silent. You held the line.</p>
            <p className="tier">
              {s.tier.toUpperCase()} — {tierName(s.tier)}
            </p>
            <p>Stamina remaining: {s.stamina}</p>
          </>
        ) : (
          <p>
            {s.kind === "lost" && s.reason === "stamina"
              ? "Your strength fails. The dead pour past you into the living world."
              : "No move remains. The graveyard claims you."}
          </p>
        )}
        <button className="btn" onClick={onRestart} style={{ marginTop: 14 }}>
          Dig Again
        </button>
      </div>
    </div>
  );
}

function tierName(t: "gold" | "silver" | "bronze"): string {
  return t === "gold" ? "Master Gravedigger" : t === "silver" ? "Seasoned Hand" : "Barely Standing";
}
