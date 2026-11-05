"use client";

import Link from "next/link";
import PhoneNudge from "./PhoneNudge";
import { useInView } from "./useStage";

// A small version of the opening sequence (delight.md §4): tamatars drop into a basket
// once the closing section scrolls into view.

const PILE = [
  { x: 8, y: 0, r: -18, s: 64 }, { x: 22, y: 6, r: 12, s: 70 }, { x: 37, y: 2, r: -6, s: 66 },
  { x: 52, y: 4, r: 20, s: 72 }, { x: 67, y: 0, r: -14, s: 64 }, { x: 81, y: 5, r: 8, s: 68 },
  { x: 15, y: 38, r: 24, s: 60 }, { x: 30, y: 44, r: -20, s: 62 }, { x: 45, y: 40, r: 6, s: 66 },
  { x: 60, y: 44, r: -10, s: 60 }, { x: 74, y: 40, r: 16, s: 62 }, { x: 38, y: 76, r: -8, s: 58 },
  { x: 56, y: 78, r: 14, s: 56 },
];

export default function TomatoRain() {
  const { ref, seen } = useInView<HTMLDivElement>(0.35);

  return (
    <div ref={ref} className="relative mx-auto flex max-w-[760px] flex-col items-center text-center">
      <div className="relative h-[230px] w-full max-w-[520px]" aria-hidden>
        {seen &&
          PILE.map((t, i) => (
            <img
              key={i}
              src="/logo.png"
              alt=""
              width={t.s}
              height={Math.round(t.s * 1.09)}
              className="lp-drop absolute"
              style={{
                left: `${t.x}%`,
                bottom: `${t.y + 34}px`,
                rotate: `${t.r}deg`,
                animationDelay: `${i * 90 + (i % 3) * 40}ms`,
              }}
            />
          ))}
        {/* the basket */}
        <svg className="absolute bottom-0 left-1/2 -translate-x-1/2" width="440" height="110" viewBox="0 0 440 110">
          <path d="M14 18 Q220 34 426 18 L392 104 Q220 112 48 104 Z" fill="#e9b97a" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 46 Q220 60 410 46 M40 74 Q220 88 400 74" fill="none" stroke="var(--ink)" strokeWidth="2" opacity=".55" />
          <path d="M100 26 L92 106 M170 30 L166 110 M240 30 L242 110 M310 28 L318 108 M372 24 L370 104" stroke="var(--ink)" strokeWidth="2" opacity=".45" />
          <path d="M8 18 Q220 36 432 18" fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>

      <h2 className="mt-8 leading-none" style={{ fontSize: "clamp(36px, 5vw, 60px)" }}>
        good things take time to ripen.
      </h2>
      <p className="mt-3 max-w-[520px] text-[1.05rem] text-ink-2">Bring a ramp problem. Bring a Pencil. Bring a bit of patience for a dramatic vegetable.</p>
      <Link href="/#waitlist" className="btn btn-red wa lp-cta mt-7 !min-h-[60px] !px-9 !text-[1.4rem]">
        join the waitlist →
      </Link>
      <p className="mt-3 text-[0.75rem] text-muted">made for iPad with Apple Pencil. a laptop and mouse work too.</p>
      <PhoneNudge className="mt-4 max-w-[26rem]" />
    </div>
  );
}
