"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { STATUS_LINES, TAP_LINES, type TomatoReactionKind } from "@/lib/tomato";
import type { TomatoState } from "@/lib/types";
import { speak } from "@/lib/voice";

// Same mechanic as before, read as concern, not decay: it stays a healthy red and just gets
// more worried (brows, a sweat drop, leaning in) when a slip repeats.
const BODY = ["#e2463a", "#e0453a", "#dd4639", "#da4739"];
const MOUTH = [
  "M40 66 Q50 76 60 66",
  "M42 68.5 Q50 70 58 68.5",
  "M41 71 Q50 64 59 71",
  "M39 70 Q44.5 65 50 70 T61 70",
];

type Props = {
  /** Defaults to the shared tamatar state from the store. */
  state?: TomatoState;
  /** px at the 24px design root; rendered in rem so it follows the UI scale. */
  size?: number;
  /** Any CSS length, e.g. "min(70vh, 80vw)" for the landing hero. Overrides size. */
  cssSize?: string;
  /** Classes for the speech text (the landing hero uses a bigger one). */
  bubbleClass?: string;
  /** Tap to squish + speech bubble. */
  interactive?: boolean;
  /** React to check results broadcast through the store. */
  listen?: boolean;
  /** Eyes follow the pointer / pen. */
  track?: boolean;
  className?: string;
  /** Animate the mouth while the explanation audio is playing. */
  speaking?: boolean;
  onTap?: () => void;
  /** Gets each line the tamatar says. When set, the page shows the line itself (no bubble). */
  onSay?: (line: string) => void;
};

/** The tamatar character (ui_planning.md §3.8, delight.md §3). */
export default function Tomato({
  state, size = 96, cssSize, bubbleClass = "text-[0.85rem]", interactive = true, listen = true, track = true, className = "", speaking = false, onTap, onSay,
}: Props) {
  const store = useStore();
  const s = (state ?? store.tomato.state) as TomatoState;
  const uid = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const face = useRef<SVGGElement>(null);
  const body = useRef<SVGSVGElement>(null);
  const pokes = useRef<number[]>([]);
  const [anim, setAnim] = useState<{ kind: TomatoReactionKind; n: number } | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  // Random blink rhythm, picked after mount so server and client markup match.
  const [blink, setBlink] = useState("5s");
  useEffect(() => setBlink(`${(4 + Math.random() * 3).toFixed(2)}s`), []);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>();
  const bubbleEl = useRef<HTMLDivElement>(null);
  // Nudge the bubble so it stays on screen when the tamatar sits near an edge.
  const [fit, setFit] = useState({ dx: 0, below: false });

  useLayoutEffect(() => {
    const el = bubbleEl.current;
    const r = wrap.current?.getBoundingClientRect();
    if (!el || !r) return;
    const m = 8;
    const vw = document.documentElement.clientWidth;
    const left = r.left + r.width / 2 - el.offsetWidth / 2;
    let dx = Math.min(0, vw - m - (left + el.offsetWidth));
    if (left + dx < m) dx = m - left;
    setFit({ dx: Math.round(dx), below: r.top - el.offsetHeight - 6 < m });
  }, [bubble]);

  // Global reactions (check results).
  useEffect(() => {
    if (listen && store.reaction) setAnim(store.reaction);
  }, [listen, store.reaction]);

  // Eyes follow the pointer.
  useEffect(() => {
    if (!track) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = wrap.current?.getBoundingClientRect();
        if (!r || !eyes.current || !face.current) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.55);
        const d = Math.hypot(dx, dy) || 1;
        // Reaches full look within ~a tamatar's width, so even small moves show.
        const k = Math.min(1, d / Math.max(60, r.width * 0.9));
        const ux = (dx / d) * k;
        const uy = (dy / d) * k;
        eyes.current.setAttribute("transform", `translate(${(ux * 4.5).toFixed(2)} ${(uy * 4).toFixed(2)})`);
        face.current.setAttribute("transform", `translate(${(ux * 5).toFixed(2)} ${(uy * 4).toFixed(2)})`);
        if (body.current) body.current.style.transform = `rotate(${(ux * 7).toFixed(2)}deg)`;
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [track]);

  const say = (line: string) => {
    clearTimeout(bubbleTimer.current);
    if (onSay) onSay(line);
    else setBubble(line);
    speak(line);
    bubbleTimer.current = setTimeout(() => setBubble(null), 2400);
  };

  const tap = () => {
    if (!interactive) return;
    const now = performance.now();
    pokes.current = [...pokes.current.filter((t) => now - t < 2000), now];
    if (pokes.current.length >= 5) {
      pokes.current = [];
      setAnim((a) => ({ kind: "flinch", n: (a?.n ?? 0) + 1 }));
      say("hey! okay, that's enough poking");
    } else {
      setAnim((a) => ({ kind: "squish", n: (a?.n ?? 0) + 1 }));
      say(Math.random() < 0.4 ? STATUS_LINES[s] : s === 3 ? "hey, we keep hitting this one. want a hint?" : TAP_LINES[Math.floor(Math.random() * TAP_LINES.length)]);
    }
    onTap?.();
  };

  const animClass = anim ? `r-${anim.kind}` : "";

  return (
    <div ref={wrap} className={`relative inline-block shrink-0 ${className}`} style={{ width: cssSize ?? `${size / 24}rem`, height: cssSize ?? `${size / 24}rem` }}>
      {bubble && (
        <div
          ref={bubbleEl}
          className={`bubble pointer-events-none absolute z-20 whitespace-nowrap text-ink ${bubbleClass}`}
          style={{
            ...(fit.below ? { top: "100%" } : { bottom: "100%" }),
            left: "50%",
            translate: `calc(-50% + ${fit.dx}px) ${fit.below ? 6 : -6}px`,
            transformOrigin: fit.below ? "top center" : "bottom center",
          }}
        >
          {bubble}
        </div>
      )}
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        ref={body}
        className="tomato"
        role={interactive ? "button" : "img"}
        aria-label={`your tamatar: ${STATUS_LINES[s]}`}
        onPointerDown={tap}
        style={{ cursor: interactive ? "pointer" : "default", transition: "transform 300ms var(--pop)", ["--blink" as string]: blink }}
      >
        <defs>
          <filter id={`boil-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="1" seed="1">
              <animate attributeName="seed" values="1;2;3" dur="0.5s" calcMode="discrete" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" scale="1.6" />
          </filter>
        </defs>
        <g key={anim?.n ?? 0} className={animClass} style={{ transformOrigin: "50% 90%" }} onAnimationEnd={(e) => e.stopPropagation()}>
          {/* leans in when it's worried about you */}
          <g style={{ transformOrigin: "50px 92px", transform: s >= 2 ? `rotate(${s === 3 ? -9 : -5}deg) scale(1.03)` : "none", transition: "transform 600ms var(--pop)" }}>
          <g className="breathe">
            <g filter={`url(#boil-${uid})`}>
              {/* body */}
              <path
                d="M50 24 C70 20 89 34 89 56 C89 78 72 92 50 92 C28 92 11 79 11 57 C11 35 30 21 50 24 Z"
                fill={BODY[s]}
                stroke="var(--ink)"
                strokeWidth="2.8"
                strokeLinejoin="round"
                style={{ transition: "fill 600ms ease" }}
              />
              <ellipse cx="30" cy="40" rx="4" ry="7.5" fill="#fff" opacity=".85" transform="rotate(30 30 40)" />
              {/* stem */}
              <g style={{ transformOrigin: "50px 24px" }}>
                <path
                  d="M50 26 L37 19 L46 20 L42 9 L50 18 L58 9 L54 20 L63 19 Z"
                  fill="#3f8f3a"
                  stroke="var(--ink)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <path d="M50 18 L51 7" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </g>
            {/* face: follows the pointer as a whole, eyes move a bit further */}
            <g ref={face} style={{ transition: "transform 140ms" }}>
            {/* worried brows: inner ends lift as concern grows */}
            {s >= 1 && (
              <path
                d={s === 1 ? "M32 46 L42 44.5 M58 44.5 L68 46" : s === 2 ? "M32 47 L42 43 M58 43 L68 47" : "M32 48 L42 42 M58 42 L68 48"}
                stroke="var(--ink)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
            {s === 0 && (
              <>
                <ellipse cx="33" cy="63" rx="4.5" ry="2.6" fill="#ff9b8f" opacity=".7" />
                <ellipse cx="67" cy="63" rx="4.5" ry="2.6" fill="#ff9b8f" opacity=".7" />
              </>
            )}
            <g className="eyes">
              <g ref={eyes} style={{ transition: "transform 120ms" }}>
                <circle cx="38" cy="54" r={s >= 2 ? 3.9 : 3.4} fill="var(--ink)" />
                <circle cx="62" cy="54" r={s >= 2 ? 3.9 : 3.4} fill="var(--ink)" />
              </g>
            </g>
            {speaking ? (
              <ellipse className="tomato-speaking" cx="50" cy="69" rx="6" ry="5" fill="var(--ink)" />
            ) : (
              <path d={MOUTH[s]} stroke="var(--ink)" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            )}
            </g>
          </g>
          </g>
          {anim?.kind === "flinch" || anim?.kind === "rot" ? (
            <path className="sweat" d="M80 34 q4 6 0 9 q-4 -3 0 -9 Z" fill="#8fd0ff" stroke="var(--ink)" strokeWidth="1.2" />
          ) : null}
          {anim?.kind === "jump" && (
            <g stroke="var(--tomato)" strokeWidth="2.4" strokeLinecap="round" className="bubble">
              <path d="M10 22 l-6 -5 M90 22 l6 -5 M50 2 l0 -6" />
            </g>
          )}
        </g>
        {/* a worried sweat drop that stays while it's concerned */}
        {s >= 2 && <path d="M79 36 q4 6 0 9 q-4 -3 0 -9 Z" fill="#8fd0ff" stroke="var(--ink)" strokeWidth="1.2" />}
      </svg>
    </div>
  );
}
