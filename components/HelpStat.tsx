"use client";

import { isDone } from "@/lib/progress";
import { useStore } from "@/lib/store";

/** Groups of five tally marks, like a margin count. */
function Marks({ n, solid }: { n: number; solid: number }) {
  const shown = Math.min(n, 40);
  return (
    <svg width={Math.ceil(shown / 5) * 30 + 6} height="26" aria-hidden className="shrink-0">
      {Array.from({ length: shown }, (_, i) => {
        const g = Math.floor(i / 5), k = i % 5, x = g * 30;
        const d = k < 4 ? `M${x + 4 + k * 5.5} 4 L${x + 3 + k * 5.5} 22` : `M${x} 18 L${x + 24} 6`;
        return <path key={i} d={d} stroke={i < solid ? "var(--tomato)" : "var(--faint)"} strokeWidth="2.2" strokeLinecap="round" />;
      })}
    </svg>
  );
}

/**
 * "14 problems, 11 solved on one mark": how much was you. Solved on one mark = finished
 * without opening the hint, explain or answer rungs on that problem.
 */
export default function HelpStat() {
  const { homework, progress, helpUsed, toast } = useStore();
  const problems = homework.filter((h) => h.due).flatMap((h) => h.problems);
  const solved = problems.filter((p) => isDone(p, progress[p.id]));
  const onMark = solved.filter((p) => (helpUsed[p.id] ?? 0) === 0).length;
  if (!solved.length) return null;

  const line = `${solved.length} problem${solved.length === 1 ? "" : "s"} solved, ${onMark} on just the red mark`;
  const share = async () => {
    const text = `${line} on tamatar.si`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("copied. go brag a little");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="hand wc mb-10 flex flex-wrap items-center gap-x-5 gap-y-2 bg-white px-5 py-3 shadow-[4px_5px_0_#f6d9d5]">
      <div>
        <div className="text-[1.5rem] leading-tight">
          {solved.length} solved <span className="text-tomato">· {onMark} on one mark</span>
        </div>
        <div className="text-[0.85rem] text-muted">red marks = finished without asking for a hint</div>
      </div>
      <Marks n={solved.length} solid={onMark} />
      <button type="button" onClick={share} className="link ml-auto text-[0.9rem] text-ink-2">
        share
      </button>
    </div>
  );
}
