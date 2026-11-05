"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import Tomato from "@/components/Tomato";
import Topbar from "@/components/Topbar";
import { useStore } from "@/lib/store";
import { STATUS_LINES } from "@/lib/tomato";
import type { TomatoState } from "@/lib/types";

const CARDS = [
  { title: "Write your work on the canvas", body: "Use your Pencil like it is paper. No typing, no special syntax." },
  { title: "Draw forces as arrows", body: "Start every arrow on the object. tamatar checks which way each one points." },
  { title: "Circle your answer when you are done", body: "A circle means finished. Then tamatar offers to check it." },
  { title: "Meet your tamatar", body: "Right answers keep it happy. Repeat a slip and it gets worried, then offers more help." },
];

/** Re-mounts its children every `ms`, so one-shot draw/write animations loop. */
function Loop({ ms, children }: { ms: number; children: React.ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return <div key={n} className="contents">{children}</div>;
}

const EQS = ["N = mg cos θ", "f = μN", "ma = mg sin θ − f"];

function WriteArt() {
  return (
    <Loop ms={4200}>
      <div className="flex h-full flex-col items-start justify-center pl-[24%] text-[1.6rem] leading-[1.4]">
        {EQS.map((l, i) => (
          <div key={l} className="write-in" style={{ ["--delay" as string]: `${200 + i * 800}ms`, ["--dur" as string]: "700ms", ["--steps" as string]: l.length }}>
            {l}
          </div>
        ))}
      </div>
    </Loop>
  );
}

function ArrowArt() {
  const arrow = (d: string, delay: number, color = "var(--ink)") => (
    <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="draw" style={{ ["--delay" as string]: `${delay}ms`, ["--dur" as string]: "600ms" }} />
  );
  return (
    <Loop ms={4200}>
      <svg viewBox="0 0 1000 440" className="h-full w-full">
        <path d="M150 380 L850 380 L150 120 Z" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinejoin="round" />
        <g transform="translate(470 299) rotate(20.4)">
          <rect x="-70" y="-100" width="140" height="100" rx="6" fill="var(--blush)" stroke="var(--ink)" strokeWidth="5" />
          {/* gravity (straight down, so un-rotate), normal (out of the ramp) */}
          <g transform="rotate(-20.4 0 -50)">{arrow("M0 -50 L0 120 M-18 98 L0 122 L18 98", 300)}</g>
          {arrow("M0 -50 L0 -230 M-18 -208 L0 -232 L18 -208", 1100)}
        </g>
        <text x="610" y="110" fontSize="34" fill="var(--good)" className="write-in" style={{ ["--delay" as string]: "1900ms", ["--dur" as string]: "500ms" }}>
          start on the block ✓
        </text>
      </svg>
    </Loop>
  );
}

function CircleArt() {
  return (
    <Loop ms={4600}>
      <div className="relative flex h-full items-center justify-center">
        <div className="relative text-[2rem]">
          a = 4.9 m/s²
          <svg className="absolute -inset-x-8 -inset-y-4 h-[calc(100%+2rem)] w-[calc(100%+4rem)] overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
            <path d="M62 3 C96 2 101 31 70 37 C40 42 2 38 2 20 C3 5 40 0 74 6" fill="none" stroke="var(--tomato)" strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="draw-px" style={{ ["--delay" as string]: "400ms", ["--dur" as string]: "700ms" }} />
          </svg>
          <span className="btn btn-red absolute -right-36 -top-8 !text-[0.9rem]" style={{ animation: "pop-in 300ms var(--pop) 1300ms both" }}>
            Check this?
          </span>
        </div>
      </div>
    </Loop>
  );
}

function TomatoArt() {
  const [s, setS] = useState<TomatoState>(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => ((x + 1) % 4) as TomatoState), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full items-center justify-center gap-8">
      <Tomato size={150} state={s} listen={false} />
      <div className="w-[40%] text-[1rem] text-ink-2">
        {STATUS_LINES[s]}
        <div className="mt-2 text-[0.8rem] text-faint">tap it to give it a squish</div>
      </div>
    </div>
  );
}

const ARTS = [WriteArt, ArrowArt, CircleArt, TomatoArt];

/** Tutorial: 4 cards with animated examples. Finishes back on the home page. */
export default function Tour() {
  const { name } = useStore();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const swipe = useRef<number | null>(null);
  const last = i === CARDS.length - 1;
  const go = (n: number) => {
    setDir(n > i ? 1 : -1);
    setI(Math.max(0, Math.min(CARDS.length - 1, n)));
  };
  const Art = ARTS[i];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Topbar />
      <main
        className="grid-paper relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6"
        onPointerDown={(e) => {
          if (e.pointerType === "touch") swipe.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipe.current == null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <Link href="/" className="link absolute right-8 top-5 text-[1rem]">
          skip
        </Link>
        <div className="mb-4 text-[1.1rem] text-ink-2">quick tour{name ? `, ${name}` : ""}</div>

        <div className="w-full max-w-[34rem]">
          <div key={i} className="hand wa bg-white px-8 pb-5 pt-6" style={{ animation: `${dir > 0 ? "board-in" : "tour-back"} 360ms var(--pop) both` }}>
            <div className="wc aspect-[1000/440] overflow-hidden border-[1.5px] border-rule bg-white">
              <Art />
            </div>
            <h1 className="mt-5 text-center text-[1.6rem] leading-tight">{CARDS[i].title}</h1>
            <p className="mx-auto mt-2 max-w-[26rem] text-center text-[1.05rem] text-ink-2">{CARDS[i].body}</p>
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label={`quick tour, ${i + 1} of 4`}>
              {CARDS.map((_, n) => (
                <button key={n} type="button" aria-label={`card ${n + 1}`} onClick={() => go(n)} className="flex h-6 w-6 items-center justify-center">
                  <span className={`block h-3 w-3 rounded-full border-2 border-ink transition-colors ${n === i ? "bg-tomato" : ""}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            {i > 0 ? (
              <Button className="wb" onClick={() => go(i - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            <Button variant="red" className="wa !px-7 !text-[1.2rem]" onClick={() => (last ? router.push("/") : go(i + 1))}>
              {last ? "Back to home" : "Next"}
            </Button>
          </div>
        </div>
        <style>{`@keyframes tour-back { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: none; } }`}</style>
      </main>
    </div>
  );
}
