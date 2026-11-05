"use client";

import Link from "next/link";
import { dueLabel } from "@/lib/due";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Homework } from "@/data/problems";
import { newId } from "@/lib/ink";
import { exportHomeworkPdf } from "@/lib/pdf";
import { worksheetProgress } from "@/lib/progress";
import { useStore } from "@/lib/store";
import { useAccountGate } from "@/lib/useAccountGate";
import { STATUS_LINES } from "@/lib/tomato";
import type { TomatoState } from "@/lib/types";
import Button from "@/components/Button";
import DueDateEdit from "@/components/DueDateEdit";
import HelpStat from "@/components/HelpStat";
import ProgressBar from "@/components/ProgressBar";
import StrokeThumb from "@/components/StrokeThumb";
import QuoteLine from "@/components/QuoteLine";
import Tomato from "@/components/Tomato";
import Topbar from "@/components/Topbar";

const SHAPES = ["wa", "wb", "wc"];
const CARD_TOMATO: Record<string, TomatoState> = { hw4: 0, hw3: 0, hw2: 1 };

export default function Home() {
  const store = useStore();
  const { name, tomato, progress, boards, saveBoard, homework } = store;
  const router = useRouter();
  const allowed = useAccountGate();
  const [exporting, setExporting] = useState<string | null>(null);

  if (!allowed) return null;

  const uploaded = homework.filter((h) => h.id.startsWith("hw-"));
  const builtIn = homework.filter((h) => !h.id.startsWith("hw-"));

  const exportPdf = async (hw: Homework) => {
    setExporting(hw.id);
    try {
      await exportHomeworkPdf(hw, store.answers, name, progress);
      store.toast("PDF saved. upload it to Canvas");
    } catch {
      store.toast("could not make the PDF. try again?");
    } finally {
      setExporting(null);
    }
  };

  const cards = (list: Homework[], offset: number) => (
    <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
      {list.map((hw, i) => {
        const { done, total, fraction, started } = worksheetProgress(hw, progress);
        const finished = done === total;
        const status = finished ? "all done" : done > 0 ? `${done} of ${total} done` : started ? "in progress" : "not started";
        const figures = hw.problems.reduce((n, p) => n + (p.figures?.length ?? 0), 0);
        return (
          <div key={hw.id} className={`card relative w-full ${SHAPES[(i + offset) % 3]} ${finished ? "" : "cut"}`} style={{ animationDelay: `${(i + offset) * 60}ms` }}>
            <Link
              href={`/solve/${hw.id}`}
              className="block"
              onPointerDown={(e) => e.currentTarget.parentElement?.classList.add("pressed")}
              onPointerUp={(e) => e.currentTarget.parentElement?.classList.remove("pressed")}
              onPointerLeave={(e) => e.currentTarget.parentElement?.classList.remove("pressed")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1.3rem] leading-tight">{hw.title}</div>
                  <div className="mt-1 text-[0.8rem] text-ink-2">
                    {hw.course} · {total} problem{total === 1 ? "" : "s"}
                    {figures ? ` · ${figures} figure${figures === 1 ? "" : "s"}` : ""}
                    {dueLabel(hw) ? ` · ${dueLabel(hw)}` : ""}
                  </div>
                  <ProgressBar fraction={fraction} label={`${hw.title} progress`} className="mt-3" />
                  <div className="mt-1 text-[1rem]">{status}</div>
                </div>
                <Tomato size={64} state={CARD_TOMATO[hw.id] ?? 0} interactive={false} listen={false} track={false} />
              </div>
            </Link>
            {!finished && hw.id.startsWith("hw-") && <DueDateEdit hw={hw} className="mt-2" />}
            {finished && (
              <Button variant="red" className="wa mt-3 w-full !min-h-[2.4rem] !text-[0.95rem]" disabledReason={exporting ? "making your PDF…" : null} onClick={() => exportPdf(hw)}>
                {exporting === hw.id ? "making PDF…" : "Export PDF"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-[1240px] px-12 pb-24 pt-10">
        <section className="mb-10 flex items-center gap-8">
          <Tomato size={112} />
          <div>
            <h1 className="leading-none" style={{ fontSize: "clamp(40px, 6vw, 68px)" }}>
              Hi {name}
            </h1>
            <p className="mt-2 text-[1.25rem] text-ink-2" aria-live="polite">
              {STATUS_LINES[tomato.state]}
            </p>
            <QuoteLine className="mt-2 text-[1.15rem]" />
          </div>
        </section>

        <HelpStat />

        {uploaded.length > 0 && (
          <>
            <h2 className="mb-4 text-[1.4rem]">Your worksheets</h2>
            {cards(uploaded, 0)}
          </>
        )}

        <h2 className="mb-4 text-[1.4rem]">Physics 121 homework</h2>
        {cards(builtIn, uploaded.length)}

        <h2 className="mb-4 text-[1.4rem]">Whiteboards</h2>
        <div className="flex flex-wrap gap-6">
          {boards.map((b, i) => (
            <Link
              key={b.id}
              href={`/board/${b.id}`}
              className={`card grid-paper ${SHAPES[(i + 1) % 3]} flex h-[170px] w-[270px] flex-col justify-end !p-3`}
              style={{ animationDelay: `${(homework.length + i) * 60}ms` }}
            >
              <StrokeThumb strokes={b.strokes} className="pointer-events-none absolute inset-2 h-[calc(100%-50px)] w-[calc(100%-16px)]" />
              <span className="relative text-[1rem]">{b.title}</span>
            </Link>
          ))}
          <button
            type="button"
            className="card flex h-[170px] w-[270px] items-center justify-center !border-dashed !border-faint text-[1.05rem] wc"
            style={{ animationDelay: `${(homework.length + boards.length) * 60}ms` }}
            onClick={() => {
              const id = newId();
              saveBoard({ id, title: "untitled board", strokes: [] });
              router.push(`/board/${id}`);
            }}
          >
            + new whiteboard
          </button>
        </div>
      </main>
    </div>
  );
}
