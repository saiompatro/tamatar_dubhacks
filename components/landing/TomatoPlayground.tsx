"use client";

import { useState } from "react";
import Tomato from "@/components/Tomato";
import type { TomatoState } from "@/lib/types";

const STATES: { label: string; line: string }[] = [
  { label: "happy", line: "a run of right answers. all smiles." },
  { label: "watchful", line: "a slip. it's keeping an eye on you." },
  { label: "concerned", line: "the same slip twice. it leans in to help." },
  { label: "worried", line: "it offers the explain rung. one right answer and it relaxes." },
];

/** Poke the tamatar; slide it through its moods, from happy to worried about you. */
export default function TomatoPlayground() {
  const [s, setS] = useState<TomatoState>(0);
  const [pokes, setPokes] = useState(0);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-12">
      <div className="relative">
        <div className="lp-spot" aria-hidden />
        <Tomato size={220} state={s} listen={false} onTap={() => setPokes((p) => p + 1)} />
        <div className="absolute -right-6 -top-6" style={{ rotate: "6deg" }}>
          <div className="sticky-note text-[0.8rem]">{pokes === 0 ? "poke me" : `${pokes} poke${pokes === 1 ? "" : "s"}`}</div>
        </div>
      </div>

      <div className="w-full max-w-[380px]">
        <div className="mb-3 grid grid-cols-4 gap-2">
          {STATES.map((st, i) => (
            <button
              key={st.label}
              type="button"
              onClick={() => setS(i as TomatoState)}
              aria-pressed={s === i}
              className={`btn ${["wa", "wb", "wc", "wa"][i]} !min-h-[40px] !px-1 !text-[0.8rem] ${s === i ? "btn-pink" : ""}`}
            >
              {st.label}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={s}
          onChange={(e) => setS(Number(e.target.value) as TomatoState)}
          className="lp-range w-full"
          aria-label="how worried is the tamatar"
        />
        <p className="mt-3 min-h-[2.6em] text-[1rem] text-ink-2" aria-live="polite">
          {STATES[s].line}
        </p>
      </div>
    </div>
  );
}
