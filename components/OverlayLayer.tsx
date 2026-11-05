"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TamatarAgent from "@/components/TamatarAgent";
import { BOARD_H, BOARD_W } from "@/lib/ink";
import { THINKING_COPY } from "@/lib/mock";
import { normalizeForFont } from "@/lib/normalize";
import type { CheckResponse, HelpLevel } from "@/lib/types";

type Props = {
  result: CheckResponse | null;
  /** Bumps on every new result so the pen re-draws. */
  resultKey: number;
  level: HelpLevel;
  thinking: boolean;
  stale: boolean;
  /** Student is erasing inside the ring: fade it. */
  dimmed: boolean;
  successText: string;
  onMarkTap: () => void;
  onCheckAgain: () => void;
  /** Points already drawn on the board (ink, the ramp, pinned thumbnails), in board units.
   *  The red-pen note is placed in empty space so it never covers any of them. */
  obstacles?: [number, number][];
  /** Optional bounded help host, separate from the ink surface so text can scroll by touch. */
  helpSlot?: HTMLElement | null;
  /** Show the read-aloud tamatar on hints (off on the public landing demo, where /api/speak is closed). */
  voice?: boolean;
};

const NO_POINTS: [number, number][] = [];

type Rect = { x: number; y: number; w: number; h: number };
type Geo = { cx: number; cy: number; rx: number; ry: number };

/**
 * Find the emptiest spot for a w×h note: scan the board, count drawn points under each
 * candidate (with a margin), never sit on the ring, and prefer spots close to the mistake.
 */
function placeNote(g: Geo, w: number, h: number, obstacles: [number, number][]): Rect {
  const pad = 16;
  const gap = 44; // room between note and ring for a readable arrow
  const ring = { x: g.cx - g.rx - gap, y: g.cy - g.ry - gap, w: 2 * g.rx + 2 * gap, h: 2 * g.ry + 2 * gap };
  const maxX = Math.max(8, BOARD_W - w - 8);
  const maxY = Math.max(8, BOARD_H - h - 8);
  let best: Rect = { x: 8, y: 8, w, h };
  let bestScore = Infinity;
  for (let y = 8; y <= maxY; y += 14) {
    for (let x = 8; x <= maxX; x += 18) {
      let hits = 0;
      for (const [px, py] of obstacles) if (px > x - pad && px < x + w + pad && py > y - pad && py < y + h + pad) hits++;
      const ox = Math.max(0, Math.min(x + w, ring.x + ring.w) - Math.max(x, ring.x));
      const oy = Math.max(0, Math.min(y + h, ring.y + ring.h) - Math.max(y, ring.y));
      const ax = Math.min(Math.max(g.cx, x), x + w);
      const ay = Math.min(Math.max(g.cy, y), y + h);
      const dx = ax - g.cx;
      const dy = ay - g.cy;
      // the connector arrow shouldn't cut across ink either
      let crossed = 0;
      const len = Math.hypot(dx, dy) || 1;
      for (const [px, py] of obstacles) {
        const t = Math.max(0, Math.min(1, ((px - g.cx) * dx + (py - g.cy) * dy) / (len * len)));
        if (t > 0.05 && Math.hypot(g.cx + dx * t - px, g.cy + dy * t - py) < 12) crossed++;
      }
      const score = hits * 500 + crossed * 120 + ox * oy * 4 + len;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y, w, h };
      }
    }
  }
  return best;
}

/** Arrow from the note's nearest edge to the ring, ending in a small head. */
function arrowPath(g: Geo, r: Rect) {
  const ax = Math.min(Math.max(g.cx, r.x), r.x + r.w);
  const ay = Math.min(Math.max(g.cy, r.y), r.y + r.h);
  const t = Math.atan2(ay - g.cy, ax - g.cx);
  const bx = g.cx + Math.cos(t) * (g.rx + 6);
  const by = g.cy + Math.sin(t) * (g.ry + 6);
  const len = Math.hypot(ax - bx, ay - by);
  if (len < 28) return null;
  const sx = ax + ((bx - ax) / len) * 8;
  const sy = ay + ((by - ay) / len) * 8;
  const mx = (sx + bx) / 2 + ((by - sy) / len) * 18;
  const my = (sy + by) / 2 - ((bx - sx) / len) * 18;
  const back = Math.atan2(by - my, bx - mx);
  const h1 = `${bx - Math.cos(back - 0.45) * 16},${by - Math.sin(back - 0.45) * 16}`;
  const h2 = `${bx - Math.cos(back + 0.45) * 16},${by - Math.sin(back + 0.45) * 16}`;
  return `M${sx},${sy} Q${mx},${my} ${bx},${by} M${h1} L${bx},${by} L${h2}`;
}

/** Wobbly ellipse that overshoots its start, like a real pen loop (§3.5). */
function ringPath(cx: number, cy: number, rx: number, ry: number) {
  const a0 = -Math.PI * (0.55 + Math.random() * 0.2);
  const k1 = Math.random() * Math.PI * 2;
  const pts: string[] = [];
  const N = 46;
  const sweep = Math.PI * 2 + 0.45;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = a0 - t * sweep;
    const wob = 1 + 0.045 * Math.sin(a * 3 + k1) + 0.03 * Math.sin(a * 5) + t * 0.06;
    pts.push(`${(cx + Math.cos(a) * rx * wob).toFixed(1)},${(cy + Math.sin(a) * ry * wob).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

/** Highlight the first sentence of an explanation with a highlighter swipe. */
function Explained({ text }: { text: string }) {
  const i = text.search(/[.!?](\s|$)/);
  if (i < 0) return <span className="hl">{text}</span>;
  return (
    <>
      <span className="hl">{text.slice(0, i + 1)}</span>
      {text.slice(i + 1)}
    </>
  );
}

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        dx: `${Math.cos((i / 8) * Math.PI * 2) * (50 + Math.random() * 40)}px`,
        dy: `${Math.sin((i / 8) * Math.PI * 2) * (50 + Math.random() * 40) - 20}px`,
        rot: `${Math.random() * 360}deg`,
        seed: i % 3,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          className="absolute"
          style={{ ["--dx" as string]: b.dx, ["--dy" as string]: b.dy, ["--rot" as string]: b.rot, animation: "confetti 900ms 500ms ease-out both" }}
        >
          {b.seed === 0 ? (
            <ellipse cx="7" cy="7" rx="3" ry="5" fill="#f6e3a1" stroke="var(--ink)" strokeWidth="1.2" />
          ) : b.seed === 1 ? (
            <path d="M2 8 L6 11 L12 3" stroke="var(--good)" strokeWidth="2" fill="none" strokeLinecap="round" />
          ) : (
            <circle cx="7" cy="7" r="4" fill="var(--tomato)" />
          )}
        </svg>
      ))}
    </div>
  );
}

export default function OverlayLayer({ result, resultKey, level, thinking, stale, dimmed, successText, onMarkTap, onCheckAgain, obstacles = NO_POINTS, helpSlot, voice = true }: Props) {
  const [copyIdx, setCopyIdx] = useState(0);
  useEffect(() => {
    if (!thinking) return;
    setCopyIdx(0);
    const t = setInterval(() => setCopyIdx((i) => (i + 1) % THINKING_COPY.length), 1200);
    return () => clearInterval(t);
  }, [thinking]);

  const geo = useMemo(() => {
    if (!result?.bbox) return null;
    const b = result.bbox;
    const cx = (b.x + b.w / 2) * BOARD_W;
    const cy = (b.y + b.h / 2) * BOARD_H;
    const rx = (b.w * BOARD_W) / 2 * 1.2 + 22;
    const ry = (b.h * BOARD_H) / 2 * 1.2 + 22;
    return { cx, cy, rx, ry, path: ringPath(cx, cy, rx, ry) };
    // resultKey re-rolls the ring shape for each new check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, resultKey]);

  const wrong = result && !result.correct;
  const markText = result?.mark ? normalizeForFont(result.mark) : "";
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  // Measure the note column, then park it in the emptiest spot near the ring.
  const root = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    const el = colRef.current;
    const box = root.current;
    if (!geo || !el || !box || !box.clientWidth) return setNote(null);
    const measure = () => {
      const unit = BOARD_W / box.clientWidth;
      setNote(placeNote(geo, el.offsetWidth * unit, el.offsetHeight * unit, obstacles));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(el);
    return () => observer.disconnect();
  }, [geo, level, obstacles, helpSlot]);
  const arrow = geo && note && markText ? arrowPath(geo, note) : null;

  const help = wrong ? (
    <div key={`help-${resultKey}`} className="help-reveals flex max-h-full min-h-0 w-full flex-col items-start gap-2">
      {level >= 1 && (result?.hint || (level >= 2 && result?.explanation) || (level >= 3 && result?.fullSolution)) && (
        <div className="help-note sticky-note sticky-drop pointer-events-auto flex max-h-full min-h-0 w-full flex-col text-left text-[0.85rem] leading-snug">
          {voice && !thinking && <TamatarAgent explanation={normalizeForFont((level >= 2 && result.explanation) || result.hint || (level >= 3 && result.fullSolution) || "")} />}
          <div className="help-copy min-h-0 overflow-y-auto overscroll-contain">
            {normalizeForFont(result.hint || "")}
            {level >= 2 && result.explanation && (
              <div className="mt-2 border-t border-dashed border-[rgba(31,26,23,.2)] pt-2 text-ink-2">
                <Explained text={normalizeForFont(result.explanation)} />
              </div>
            )}
            {level >= 3 && result?.fullSolution && (
              <div className="solution slide-in mt-3 w-full border-[2px] border-[rgba(31,26,23,.7)] text-left text-[0.8rem] text-ink wb">
                <div className="text-[0.7rem] text-tomato">full solution</div>
                {normalizeForFont(result.fullSolution)
                  .split("\n")
                  .map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div ref={root} className="pointer-events-none absolute inset-0" aria-live="polite">
      <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className="absolute inset-0 h-full w-full overflow-visible">
        {thinking && (
          <rect x="6" y="6" width={BOARD_W - 12} height={BOARD_H - 12} rx="18" fill="none" stroke="var(--tomato-2)" strokeWidth="3" className="thinking-border" />
        )}
        {wrong && geo && (
          <g key={resultKey} style={{ opacity: dimmed || stale ? 0.3 : 1, transition: "opacity 200ms" }}>
            <path
              d={geo.path}
              pathLength={1}
              fill="none"
              stroke="var(--tomato)"
              strokeWidth="4.5"
              strokeLinecap="round"
              className="draw"
              style={{ ["--dur" as string]: "550ms" }}
            />
            {/* fat invisible hit area: tap the ring to open help */}
            <path d={geo.path} fill="none" stroke="transparent" strokeWidth="28" className="pointer-events-auto cursor-pointer" onClick={onMarkTap} />
            {arrow && (
              <path
                key={arrow}
                d={arrow}
                pathLength={1}
                fill="none"
                stroke="var(--tomato)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="draw"
                style={{ ["--dur" as string]: "250ms", ["--delay" as string]: `${700 + markText.length * 25}ms` }}
              />
            )}
          </g>
        )}
      </svg>

      {/* Note + help reveals, in empty space: never over the ring, the ink or the drawing */}
      {wrong && geo && (
        <div
          key={`col-${resultKey}`}
          ref={colRef}
          className="absolute flex w-max max-w-[32%] flex-col items-start gap-2"
          style={{
            left: pct(note?.x ?? 0, BOARD_W),
            top: pct(note?.y ?? 0, BOARD_H),
            visibility: note ? "visible" : "hidden",
            opacity: dimmed ? 0.3 : 1,
            transition: "opacity 200ms, left 300ms var(--pop), top 300ms var(--pop)",
          }}
        >
          {markText && (
            <button
              type="button"
              onClick={onMarkTap}
              className="red-note write-in pointer-events-auto text-left leading-tight"
              style={{
                fontSize: "1.15rem",
                rotate: "-4deg",
                ["--dur" as string]: `${markText.length * 25}ms`,
                ["--steps" as string]: markText.length,
                ["--delay" as string]: "700ms",
              }}
            >
              {markText}
            </button>
          )}
          {!helpSlot && help}
        </div>
      )}

      {wrong && stale && geo && (
        <button
          type="button"
          onClick={onCheckAgain}
          className="bubble btn btn-pink pointer-events-auto absolute text-[0.8rem]"
          style={{ left: pct(geo.cx, BOARD_W), top: pct(Math.min(BOARD_H - 40, geo.cy + geo.ry + 8), BOARD_H), translate: "-50% 0" }}
        >
          check again
        </button>
      )}

      {/* Correct: a green check draws itself next to the work */}
      {result?.correct && (
        <div
          key={`ok-${resultKey}`}
          className="absolute flex items-center gap-2"
          style={{
            left: pct(Math.min(BOARD_W - 300, ((result.bbox?.x ?? 0.4) + (result.bbox?.w ?? 0.2)) * BOARD_W + 30), BOARD_W),
            top: pct(Math.max(20, ((result.bbox?.y ?? 0.4) + (result.bbox?.h ?? 0.2) / 2) * BOARD_H - 50), BOARD_H),
          }}
        >
          <div className="relative">
            <svg width="86" height="76" viewBox="0 0 86 76">
              <path d="M6 40 L30 66 L80 6" pathLength={1} fill="none" stroke="var(--good)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="draw" style={{ ["--dur" as string]: "500ms" }} />
            </svg>
            <Confetti />
          </div>
          <div className="write-in text-good" style={{ fontSize: "1.3rem", rotate: "-3deg", ["--delay" as string]: "450ms", ["--dur" as string]: `${successText.length * 25}ms`, ["--steps" as string]: successText.length }}>
            {successText}
          </div>
        </div>
      )}

      {helpSlot && help && level >= 1 && createPortal(help, helpSlot)}

      {thinking && (
        <div className="sticky-note sticky-drop absolute right-4 top-4 flex items-center gap-2 text-[0.85rem]">
          <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0" style={{ animation: "wiggle .5s ease-in-out infinite" }}>
            <path d="M4 22 L6 16 L18 4 L22 8 L10 20 Z" fill="var(--tomato)" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span key={copyIdx} className="bubble">
            {THINKING_COPY[copyIdx]}
          </span>
        </div>
      )}
    </div>
  );
}
