// Feedback effects: procedural sound (WebAudio — no asset files, works offline) and haptics.
// Sound is OFF by default (auto-playing audio is hostile); haptics ON. Both toggle in the menu.

export interface Settings {
  sound: boolean;
  haptics: boolean;
}

/**
 * Whether the device supports the Vibration API. Absent on iOS Safari (Apple doesn't implement it),
 * present on Android. Used to default haptics on/off and to disable the toggle where unsupported.
 */
export const hapticsSupported =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const KEY = "gd-settings-v1";
// One feedback channel on by default per platform: haptics where supported (Android),
// otherwise sound (iOS, which has no Vibration API).
const DEFAULTS: Settings = { sound: !hapticsSupported, haptics: hapticsSupported };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

// --- runtime flags, set from settings ---
let soundOn = DEFAULTS.sound;
let hapticsOn = DEFAULTS.haptics;
export function setSound(on: boolean): void {
  soundOn = on;
}
export function setHaptics(on: boolean): void {
  hapticsOn = on;
}

// --- WebAudio (lazily created on first user-triggered cue, per autoplay policy) ---
type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC: Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
    ctx ||= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short enveloped tone; optional pitch glide for a little character. */
function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; delay?: number; glideTo?: number } = {},
): void {
  const c = audio();
  if (!c) return;
  const { type = "sine", gain = 0.12, delay = 0, glideTo } = opts;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export type Cue =
  | "select"
  | "kill"
  | "fester"
  | "suffer"
  | "ritual"
  | "burn"
  | "omen"
  | "cantdo"
  | "win"
  | "lose";

export function playCue(cue: Cue): void {
  if (!soundOn) return;
  switch (cue) {
    case "select":
      tone(420, 0.05, { type: "triangle", gain: 0.05 });
      break;
    case "kill": // bright, resolving chime
      tone(523, 0.14, { type: "triangle", gain: 0.12 });
      tone(784, 0.16, { type: "triangle", gain: 0.09, delay: 0.04 });
      break;
    case "fester": // dull thud — you failed to kill
      tone(150, 0.16, { type: "sawtooth", gain: 0.09, glideTo: 90 });
      break;
    case "suffer": // low ominous pulse
      tone(90, 0.22, { type: "sine", gain: 0.11, glideTo: 60 });
      break;
    case "ritual":
      tone(660, 0.2, { type: "sine", gain: 0.08 });
      tone(990, 0.24, { type: "sine", gain: 0.06, delay: 0.06 });
      break;
    case "burn":
      tone(300, 0.25, { type: "sawtooth", gain: 0.08, glideTo: 120 });
      break;
    case "omen":
      tone(520, 0.14, { type: "sine", gain: 0.07, glideTo: 720 });
      break;
    case "cantdo": // dull, dissonant "no" — two clashing low tones
      tone(150, 0.13, { type: "square", gain: 0.07 });
      tone(159, 0.13, { type: "square", gain: 0.07 });
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.28, { type: "triangle", gain: 0.11, delay: i * 0.12 }),
      );
      break;
    case "lose":
      [330, 247, 165].forEach((f, i) =>
        tone(f, 0.4, { type: "sawtooth", gain: 0.1, delay: i * 0.16, glideTo: f * 0.85 }),
      );
      break;
  }
}

/** "You can't do that" feedback: dissonant cue + a short double-buzz. */
export function denied(): void {
  playCue("cantdo");
  buzz([18, 40, 18]);
}

/** Vibrate (mobile). No-op if disabled or unsupported. */
export function buzz(pattern: number | number[]): void {
  if (!hapticsOn) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
