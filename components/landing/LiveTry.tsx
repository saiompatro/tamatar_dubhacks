"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import InkCanvas, { type LoopBox } from "@/components/InkCanvas";
import OverlayLayer from "@/components/OverlayLayer";
import RampDiagram from "@/components/RampDiagram";
import { getProblem } from "@/data/problems";
import { MOCK } from "@/lib/api";
import { DEMO_PROBLEM_ID } from "@/lib/demo";
import { BOARD_H, BOARD_W, bboxOf, exportPng } from "@/lib/ink";
import { delay } from "@/lib/motion";
import { mockCheck } from "@/lib/mock";
import type { CheckResponse, HelpLevel } from "@/lib/types";
import { useInk } from "@/lib/useInk";

const RUNGS = ["mark", "hint", "explain", "answer"] as const;

/**
 * The landing page's one live problem: write the equations for the friction ramp, circle
 * your answer, and the real red pen (/api/try) marks the first slip. Not a replay.
 */
export default function LiveTry() {
  const problem = useMemo(() => getProblem(DEMO_PROBLEM_ID)!, []);
  const ink = useInk();
  const [loop, setLoop] = useState<LoopBox | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [key, setKey] = useState(0);
  const [stale, setStale] = useState(false);
  const [level, setLevel] = useState<HelpLevel>(0);
  const [tally, setTally] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!loop) return;
    const t = setTimeout(() => setLoop(null), 4000);
    return () => clearTimeout(t);
  }, [loop]);

  const check = async (isFinal: boolean) => {
    if (!ink.strokes.length || thinking) return;
    setLoop(null);
    setThinking(true);
    setError(null);
    setStale(false);
    try {
      let res: CheckResponse;
      if (MOCK) {
        await delay(1600);
        res = mockCheck({ problem, part: "equations", attempt: attempts, bbox: bboxOf(ink.strokes.slice(-1)) });
      } else {
        const r = await fetch("/api/try", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ imageBase64: await exportPng(ink.strokes), isFinal }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? "the red pen is offline right now. try again in a bit?");
        res = body as CheckResponse;
      }
      setResult(res);
      setKey((k) => k + 1);
      setAttempts((a) => a + 1);
      setLevel(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "the red pen is offline right now. try again in a bit?");
    } finally {
      setThinking(false);
    }
  };

  const reveal = (l: HelpLevel) => {
    if (result && !result.correct && l > level) setTally((t) => t + (l - level));
    setLevel(l);
  };

  const obstacles = useMemo(() => {
    const pts: [number, number][] = [];
    for (const s of ink.strokes) for (let i = 0; i < s.points.length; i += 2) pts.push([s.points[i][0], s.points[i][1]]);
    return pts;
  }, [ink.strokes]);

  const wrong = !!result && !result.correct;

  return (
    <div className="hand wb relative bg-white p-4 shadow-[6px_8px_0_#f6d9d5] sm:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[0.95rem] text-tomato">try it: this one is live</span>
            <span className="rounded-full bg-blush px-2 text-[0.65rem] text-tomato">{MOCK ? "demo mode" : "real red pen"}</span>
          </div>
          <p className="mt-1 text-[0.9rem] leading-snug text-ink-2">
            A 5 kg block slides down a 30° ramp with μk = 0.2. Write the equation along the ramp and solve for a. Circle your answer when you&rsquo;re done.
          </p>
        </div>
        <RampDiagram angle={30} width={96} />
      </div>

      <div className="relative mt-3">
        <InkCanvas
          ink={ink}
          allowTouch
          className="wc overflow-visible border-[1.5px] border-rule"
          placeholder="write ma = … here, then circle your answer"
          onStroke={() => result && setStale(true)}
          onCircle={(b) => setLoop(b)}
        >
          <OverlayLayer
            result={result}
            resultKey={key}
            level={level}
            thinking={thinking}
            stale={stale}
            dimmed={false}
            successText="that's it. no slips."
            onMarkTap={() => reveal(Math.max(1, level) as HelpLevel)}
            onCheckAgain={() => check(false)}
            obstacles={obstacles}
            voice={false}
          />
          {loop && (
            <button
              key={`${loop.x}-${loop.y}`}
              type="button"
              className="bubble btn btn-red absolute z-10 !text-[0.85rem]"
              style={{ left: `${((loop.x + loop.w) / BOARD_W) * 100}%`, top: `${(loop.y / BOARD_H) * 100}%`, translate: "6px -60%" }}
              onClick={() => check(true)}
            >
              Check this?
            </button>
          )}
        </InkCanvas>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="red" className="wa !min-h-[2.4rem] !px-5 !text-[1.05rem]" disabledReason={thinking ? "the red pen is still reading" : ink.strokes.length ? null : "write something first"} onClick={() => check(false)}>
          Check
        </Button>
        <button type="button" className="h-10 rounded-full px-3 text-[0.85rem] text-muted hover:bg-blush disabled:opacity-30" disabled={!ink.canUndo} onClick={ink.undo}>
          undo
        </button>
        <button
          type="button"
          className="h-10 rounded-full px-3 text-[0.85rem] text-muted hover:bg-blush disabled:opacity-30"
          disabled={!ink.strokes.length}
          onClick={() => {
            ink.clear();
            setResult(null);
            setLevel(0);
          }}
        >
          clear
        </button>
        {/* the help ladder, right here: you choose how much help */}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="how much help">
          {RUNGS.map((r, i) => (
            <button
              key={r}
              type="button"
              disabled={!wrong}
              onClick={() => reveal(i as HelpLevel)}
              className={`rounded-full border-[1.5px] px-2.5 py-1 text-[0.8rem] transition-colors disabled:opacity-35 ${
                wrong && i === level ? "border-tomato bg-blush text-tomato" : "border-rule text-ink-2"
              }`}
            >
              {r}
            </button>
          ))}
          <span className="ml-1 text-[0.75rem] text-muted" title="help used">
            tally {tally}
          </span>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[0.85rem] text-tomato">
          {error}
        </p>
      )}
    </div>
  );
}
