import type { TomatoState } from "./types";

export type TomatoMemory = { state: TomatoState; lastErrorKey: string | null };

export type TomatoReactionKind = "jump" | "flinch" | "rot" | "squish" | "lean";

export const STATUS_LINES: Record<TomatoState, string> = {
  0: "your tamatar is happy today",
  1: "your tamatar is keeping an eye on you",
  2: "your tamatar is a little worried about you",
  3: "your tamatar is worried. try the explain rung?",
};

/** Things tamatar says at random: on the home pages and when you poke it. Hand-written, no AI. */
export const QUOTES = [
  "are you a dodo",
  "I am going to paint you red",
  "good morning Mr. Missed his lecture",
  "lowkey highkey stop",
  "normal force goes out of the ramp. always.",
  "sin or cos? think before you write",
  "circle it like you mean it",
  "i have seen your free-body diagrams",
  "units. please. i'm begging.",
  "arre, mg sin θ, not mg cos θ",
  "same slip twice? i'll get the explain rung",
  "start the arrow on the block, not the moon",
  "the red pen is warming up",
  "friction always fights back",
  "shabash! now do the next one",
  "your TA would be proud. probably.",
];

export const TAP_LINES = [
  "hehe, that tickles",
  "okay, let's do some physics!",
  "ready when you are",
  "arre, careful with the pen",
  "poke me after you circle something",
  ...QUOTES,
];

/** A random quote that isn't `prev`. */
export function randomQuote(prev?: string) {
  let q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  while (q === prev) q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  return q;
}

const clamp = (n: number) => Math.max(0, Math.min(3, n)) as TomatoState;

/** Wrong answer: flinch. Repeating the same mistake makes it one step more worried. */
export function onWrong(m: TomatoMemory, errorKey: string | null): { next: TomatoMemory; reaction: TomatoReactionKind } {
  const repeat = errorKey != null && errorKey === m.lastErrorKey;
  return {
    next: { state: repeat ? clamp(m.state + 1) : m.state, lastErrorKey: errorKey },
    reaction: repeat ? "rot" : "flinch",
  };
}

/** Right answer: jump and recover one state. */
export function onRight(m: TomatoMemory): { next: TomatoMemory; reaction: TomatoReactionKind } {
  return { next: { state: clamp(m.state - 1), lastErrorKey: null }, reaction: "jump" };
}
