"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FitBoard from "@/components/Board";
import Button from "@/components/Button";
import FigureImage from "@/components/FigureImage";
import FontSizer from "@/components/FontSizer";
import HelpLevelBar from "@/components/HelpLevelBar";
import InkCanvas, { type LoopBox, type Tool } from "@/components/InkCanvas";
import Modal from "@/components/Modal";
import OverlayLayer from "@/components/OverlayLayer";
import PartTabs from "@/components/PartTabs";
import ProblemPanel, { Dots } from "@/components/ProblemPanel";
import ProgressBar from "@/components/ProgressBar";
import RampDiagram from "@/components/RampDiagram";
import StrokeThumb from "@/components/StrokeThumb";
import Tally from "@/components/Tally";
import Tomato from "@/components/Tomato";
import Toolbar from "@/components/Toolbar";
import Topbar from "@/components/Topbar";
import { useChecker } from "@/components/useChecker";
import { MOCK } from "@/lib/api";
import { BOARD_H, BOARD_W } from "@/lib/ink";
import { exportHomeworkPdf, underlayFor } from "@/lib/pdf";
import { isDone, partsOf, worksheetProgress, type PartProgress } from "@/lib/progress";
import { rampPoints } from "@/lib/ramp";
import { load, save } from "@/lib/storage";
import { useStore } from "@/lib/store";
import type { Figure, HelpLevel, Problem, ProblemPart } from "@/lib/types";
import { useAccountGate } from "@/lib/useAccountGate";
import { useInk } from "@/lib/useInk";

const EMPTY_PROGRESS = { fbd: false, equations: false };

// The diagram pinned on the equations board: bottom-right, about a third of the board wide.
const THUMB = { w: 330, h: 330 * (BOARD_H / BOARD_W), m: 14 };
const THUMB_PTS: [number, number][] = [];
for (let x = BOARD_W - THUMB.m - THUMB.w; x <= BOARD_W - THUMB.m; x += 20)
  for (let y = BOARD_H - THUMB.m - THUMB.h; y <= BOARD_H - THUMB.m; y += 20) THUMB_PTS.push([x, y]);

/** A text-size preference kept in this browser (per viewer, not part of the homework). */
function useScale(key: string) {
  const [v, setV] = useState(() => load(key, 1));
  return [v, (n: number) => { setV(n); save(key, n); }] as const;
}

/** Open a problem on its diagram until that part is done, then on the solution. */
const startPart = (p: Problem, pr: PartProgress | undefined): ProblemPart =>
  partsOf(p).includes("fbd") && !pr?.fbd ? "fbd" : "equations";

export default function Solve({ params }: { params: { hw: string } }) {
  const router = useRouter();
  const store = useStore();
  const allowed = useAccountGate();
  const hw = store.homework.find((h) => h.id === params.hw && h.due) ?? store.homework[0];
  const [index, setIndex] = useState(0);
  const problem = hw.problems[index];
  const [part, setPart] = useState<ProblemPart>("fbd");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1f1a17");
  const [size, setSize] = useState(7);
  const [panelOpen, setPanelOpen] = useState(true);
  const [turning, setTurning] = useState(0);
  const [peek, setPeek] = useState(false);
  const [loop, setLoop] = useState<LoopBox | null>(null);
  const [exporting, setExporting] = useState(false);
  const [railOpen, setRailOpenRaw] = useState(() => load("railOpen", true));
  const setRailOpen = (o: boolean) => { setRailOpenRaw(o); save("railOpen", o); };
  const [listFont, setListFont] = useScale("listFont");
  // Keep help in a viewport-sized note on the writing surface.
  const [helpSlot, setHelpSlot] = useState<HTMLElement | null>(null);
  const [questionFont, setQuestionFont] = useScale("questionFont");
  const [zoom, setZoom] = useState<Figure | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 1366px)").matches) setPanelOpen(false);
  }, []);

  const angle = parseInt(problem.givenValues["θ"] ?? "30") || 30;
  const isRamp = problem.type === "inclined_plane";
  const withDiagram = partsOf(problem).includes("fbd");
  // what's printed on the diagram board: the ramp, the problem's own setup drawing, or nothing
  const underlay = useMemo(() => underlayFor(problem), [problem]);

  const level = store.helpLevel;
  const fbdInk = useInk();
  const eqInk = useInk();
  const ink = part === "fbd" ? fbdInk : eqInk;
  const fbdCheck = useChecker({ problem, part: "fbd", level, underlay });
  const eqCheck = useChecker({ problem, part: "equations", level });
  const chk = part === "fbd" ? fbdCheck : eqCheck;

  const prog = store.progress[problem.id] ?? EMPTY_PROGRESS;
  const { done: doneCount, fraction } = worksheetProgress(hw, store.progress);
  const allDone = doneCount === hw.problems.length;
  const problemDone = isDone(problem, prog);

  // Open on the first unfinished problem with its saved ink, once saved data has loaded.
  const opened = useRef(false);
  useEffect(() => {
    if (!store.ready || !store.authReady || opened.current) return;
    opened.current = true;
    const first = Math.max(0, hw.problems.findIndex((p) => !isDone(p, store.progress[p.id])));
    const p = hw.problems[first];
    const a = store.answers[p.id];
    fbdInk.reset(a?.fbd ?? []);
    eqInk.reset(a?.equations ?? []);
    setPart(startPart(p, store.progress[p.id]));
    setIndex(first);
  }, [store.ready, store.authReady, store.progress, store.answers, hw.problems, fbdInk, eqInk]);

  // Autosave the current problem's ink so a break (or a reload) never loses work.
  const { saveAnswer } = store;
  useEffect(() => {
    if (!opened.current) return;
    const t = setTimeout(() => saveAnswer(problem.id, { fbd: fbdInk.strokes, equations: eqInk.strokes }), 500);
    return () => clearTimeout(t);
  }, [fbdInk.strokes, eqInk.strokes, problem.id, saveAnswer]);

  const saveNow = () => {
    saveAnswer(problem.id, { fbd: fbdInk.strokes, equations: eqInk.strokes });
    store.toast(`saved. ${doneCount} of ${hw.problems.length} done, take a break`);
  };

  const selectProblem = useCallback(
    (i: number) => {
      if (i === index) return;
      saveAnswer(problem.id, { fbd: fbdInk.strokes, equations: eqInk.strokes });
      const next = hw.problems[i];
      const a = store.answers[next.id];
      fbdInk.reset(a?.fbd ?? []);
      eqInk.reset(a?.equations ?? []);
      fbdCheck.reset();
      eqCheck.reset();
      setLoop(null);
      setZoom(null);
      setPart(startPart(next, store.progress[next.id]));
      setIndex(i);
    },
    [index, problem.id, fbdInk, eqInk, hw.problems, fbdCheck, eqCheck, store.progress, store.answers, saveAnswer],
  );

  const runCheck = useCallback(
    async (isFinal = false) => {
      setLoop(null);
      const res = await chk.check(ink.strokes, isFinal);
      if (!res?.correct) return;
      if (part === "fbd") {
        store.setProgress(problem.id, { ...prog, fbd: true });
        setTimeout(() => store.toast("on to the equations →"), 1400);
      } else {
        store.setProgress(problem.id, { fbd: true, equations: true });
        const finished = doneCount + 1 >= hw.problems.length;
        setTimeout(() => store.toast(finished ? "homework done! export it as a PDF" : "your tamatar perked right up"), 1400);
      }
    },
    [chk, ink.strokes, part, store, problem.id, prog, doneCount, hw.problems.length],
  );

  const next = useCallback(() => {
    if (index >= hw.problems.length - 1) return router.push("/home");
    setTurning((t) => t + 1);
    setTimeout(() => selectProblem(index + 1), 250);
  }, [index, hw.problems.length, router, selectProblem]);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const answers = { ...store.answers, [problem.id]: { fbd: fbdInk.strokes, equations: eqInk.strokes } };
      await exportHomeworkPdf(hw, answers, store.name, store.progress);
      store.toast("PDF saved. upload it to Canvas");
    } catch {
      store.toast("could not make the PDF. try again?");
    } finally {
      setExporting(false);
    }
  };

  const setLevel = (l: HelpLevel) => {
    store.setHelpLevel(l);
    chk.countReveal(l, !!chk.result && !chk.result.correct);
    if (chk.result && !chk.result.correct) store.noteHelp(problem.id, l);
    if (l >= 2) setNudge(false);
  };

  // Same slip twice in a row: the tamatar leans in and offers the explain rung (concern, not shame).
  const lastSlip = useRef<Record<string, string | null>>({});
  const [nudge, setNudge] = useState(false);
  useEffect(() => {
    const r = chk.result;
    if (!r) return setNudge(false);
    const k = `${problem.id}:${part}`;
    const repeat = !r.correct && !!r.errorKey && lastSlip.current[k] === r.errorKey;
    lastSlip.current[k] = r.correct ? null : r.errorKey;
    if (!r.correct) store.noteHelp(problem.id, store.helpLevel);
    setNudge(repeat && store.helpLevel < 2);
    if (repeat) store.react("lean");
    // runs once per new check result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chk.key, part]);

  const checkReason = chk.thinking ? "the red pen is still reading" : !ink.strokes.length ? (part === "fbd" ? "draw the forces first" : "write your answer first") : null;
  const nextReason = problemDone ? null : withDiagram && !prog.fbd ? "get the diagram right first" : withDiagram ? "finish the equations first" : "finish the solution first";

  // Drawing shortcuts live in Toolbar. Keep page actions away from calculator inputs.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input,textarea,select,button,[contenteditable=true],[role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        return saveNow();
      }
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "Enter" && !checkReason) runCheck();
      else if (["1", "2", "3", "4"].includes(e.key)) setLevel((Number(e.key) - 1) as HelpLevel);
      else if (e.key === "ArrowRight" && !nextReason) next();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // "Check this?" bubble fades if ignored.
  useEffect(() => {
    if (!loop) return;
    const t = setTimeout(() => setLoop(null), 4000);
    return () => clearTimeout(t);
  }, [loop]);

  // Everything already on the board, so the red-pen note lands in empty space.
  const obstacles = useMemo(() => {
    const pts: [number, number][] = part === "fbd" ? (isRamp ? rampPoints(angle) : []) : withDiagram ? [...THUMB_PTS] : [];
    for (const st of ink.strokes) for (let i = 0; i < st.points.length; i += 2) pts.push([st.points[i][0], st.points[i][1]]);
    return pts;
  }, [part, angle, isRamp, withDiagram, ink.strokes]);

  const ringBox = chk.result?.bbox;
  const feedback = chk.thinking || !!chk.result;

  if (!allowed) return null;

  return (
    // fixed to the viewport: the page never scrolls or bounces under the Pencil
    <div className="solve-page fixed inset-0 flex flex-col overflow-hidden overscroll-none">
      <Topbar>
        <div className="hidden items-center gap-3 text-[0.9rem] text-muted 2xl:flex">
          <span className="max-w-[14rem] truncate whitespace-nowrap">{hw.title}</span>
          <ProgressBar fraction={fraction} label={`${hw.title} progress`} className="w-[9rem]" />
          <span className="hidden 2xl:inline-flex"><Dots total={hw.problems.length} done={doneCount} current={index} /></span>
        </div>
      </Topbar>

      <div className="solve-body relative flex min-h-0 flex-1">
        <ProblemPanel
          hw={hw}
          index={index}
          progress={store.progress}
          open={panelOpen}
          setOpen={setPanelOpen}
          onSelect={selectProblem}
          fontScale={listFont}
          setFontScale={setListFont}
        />

        <section key={turning} className={`solve-workspace flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-6 pb-4 pt-4 ${turning ? "page-turn" : ""}`}>
          {/* problem: just the label, the question and the setup */}
          <div className="solve-question flex shrink-0 flex-wrap items-start gap-3">
            <div className="solve-question-text min-w-0 flex-1 basis-[20rem]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="text-[1.15rem] text-tomato">Problem {index + 1}</div>
                {problem.topic && <div className="text-[0.8rem] text-muted">{problem.topic}</div>}
                <FontSizer value={questionFont} onChange={setQuestionFont} label="question text" />
              </div>
              <p className="mt-1 leading-snug text-ink-2" style={{ fontSize: `${questionFont}rem` }}>
                {problem.text}
              </p>
            </div>
            {problem.figures?.map((f, i) => (
              <button
                key={f.src}
                type="button"
                aria-label={`enlarge figure ${i + 1}`}
                onClick={() => setZoom(f)}
                className="hand wa shrink-0 overflow-hidden bg-white p-1 transition-transform hover:-rotate-1"
              >
                <FigureImage figure={f} className="h-[4.5rem] w-[6.5rem]" />
              </button>
            ))}
            {isRamp ? (
              <button type="button" aria-label="show the ramp on the diagram board" onClick={() => setPart("fbd")} className="shrink-0 rounded-xl p-1 transition-colors hover:bg-blush">
                <RampDiagram angle={angle} width={120} />
              </button>
            ) : (
              problem.diagramSvg && (
                <button type="button" aria-label="show the setup on the diagram board" onClick={() => setPart("fbd")} className="shrink-0 rounded-xl p-1 transition-colors hover:bg-blush">
                  <svg viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} width={130} aria-hidden dangerouslySetInnerHTML={{ __html: problem.diagramSvg }} />
                </button>
              )
            )}
          </div>

          {withDiagram ? (
            <PartTabs part={part} locked={!prog.fbd} onChange={(p) => { setPart(p); setLoop(null); }} />
          ) : (
            <div className="text-[1.05rem] text-ink-2">your solution <span className="text-[0.85rem] text-muted">· write it out below, then press Check</span></div>
          )}

          <FitBoard>
            <div key={part} className="board-enter relative">
              <InkCanvas
                ink={ink}
                tool={tool}
                color={color}
                size={size}
                placeholder={part === "fbd" ? "" : withDiagram ? "write your equations here" : "write your solution here"}
                className="hand wb overflow-visible"
                background={part === "fbd" && underlay ? <g dangerouslySetInnerHTML={{ __html: underlay }} /> : undefined}
                onStroke={() => chk.markStale()}
                onCircle={(b) => setLoop(b)}
                onEraseAt={(x, y) => {
                  if (!ringBox) return;
                  const inside = x > ringBox.x * BOARD_W - 30 && x < (ringBox.x + ringBox.w) * BOARD_W + 30 && y > ringBox.y * BOARD_H - 30 && y < (ringBox.y + ringBox.h) * BOARD_H + 30;
                  if (inside) chk.dim();
                }}
              >
                {part === "fbd" && !fbdInk.strokes.length && (
                  <div className="pointer-events-none absolute right-6 top-5 text-[1rem] text-faint">
                    {problem.boardHint ?? (isRamp ? "draw the forces on the block as arrows" : "draw the free-body diagram")}
                  </div>
                )}
                <OverlayLayer
                  result={chk.result}
                  resultKey={chk.key}
                  level={level}
                  thinking={chk.thinking}
                  stale={chk.stale}
                  dimmed={chk.dimmed}
                  successText={part === "fbd" ? `nice diagram, ${store.name || "friend"}!` : "you got it!"}
                  onMarkTap={() => level === 0 && setLevel(1)}
                  onCheckAgain={() => runCheck()}
                  obstacles={obstacles}
                  helpSlot={helpSlot}
                />
                {loop && (
                  <button
                    key={`${loop.x}-${loop.y}`}
                    type="button"
                    className="bubble btn btn-red absolute z-10 !text-[0.9rem]"
                    style={{ left: `${((loop.x + loop.w) / BOARD_W) * 100}%`, top: `${(loop.y / BOARD_H) * 100}%`, translate: "6px -60%" }}
                    onClick={() => runCheck(true)}
                  >
                    Check this?
                  </button>
                )}
                {/* your diagram, pinned bottom-right of the equations board (tap for full size) */}
                {part === "equations" && withDiagram && (
                  <button
                    type="button"
                    aria-label="peek at your diagram"
                    onClick={() => setPeek(true)}
                    className="hand wa absolute z-10 overflow-hidden bg-white shadow-[3px_4px_0_#f6d9d5]"
                    style={{
                      right: `${(THUMB.m / BOARD_W) * 100}%`,
                      bottom: `${(THUMB.m / BOARD_H) * 100}%`,
                      width: `${(THUMB.w / BOARD_W) * 100}%`,
                      aspectRatio: `${BOARD_W} / ${BOARD_H}`,
                      animation: "board-in 400ms var(--pop) both",
                    }}
                  >
                    <span className="absolute left-2 top-1 text-[0.7rem] text-muted">your diagram</span>
                    <StrokeThumb strokes={fbdInk.strokes} underlay={underlay} className="h-full w-full" />
                  </button>
                )}
                {/* the tamatar peeks in from the corner during feedback */}
                <div
                  className="absolute -right-5 -top-5 z-10 transition-transform duration-500"
                  style={{ transform: feedback ? "translate(0,0) rotate(-8deg)" : "translate(30px, 40px) rotate(10deg) scale(.6)", opacity: feedback ? 1 : 0, transitionTimingFunction: "var(--pop)" }}
                >
                  <Tomato size={70} track />
                </div>
              </InkCanvas>
              <div ref={setHelpSlot} className="board-help" />
            </div>
          </FitBoard>
          <Toolbar ink={ink} tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize} />
        </section>

        <aside className={`solve-rail flex w-[12.5rem] shrink-0 flex-col gap-4 border-l-[1.5px] border-dashed border-rule bg-white px-5 py-4 ${railOpen ? "" : "solve-rail-collapsed"}`}>
          <button type="button" onClick={() => setRailOpen(!railOpen)} className="solve-rail-toggle link self-end text-[0.8rem] text-muted" aria-label={railOpen ? "hide the side panel" : "show the side panel"}>
            {railOpen ? "Hide →" : "← Show"}
          </button>
          <Button variant="red" className="wa w-full !min-h-[3.4rem] !text-[1.5rem]" disabledReason={checkReason} onClick={() => runCheck()}>
            Check
          </Button>
          {chk.error && <p role="alert" className="solve-error text-[0.85rem] text-tomato">{chk.error}</p>}
          {nudge && (
            <div className="sticky-note sticky-drop text-[0.85rem] leading-snug" role="status">
              we&rsquo;ve hit this one twice. want the explain rung?
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-red wa !min-h-[2rem] !px-3 !text-[0.8rem]" onClick={() => setLevel(2)}>
                  yes, explain
                </button>
                <button type="button" className="link text-[0.8rem] text-muted" onClick={() => setNudge(false)}>
                  not yet
                </button>
              </div>
            </div>
          )}
          <div className="solve-help-vertical"><HelpLevelBar level={level} onChange={setLevel} compact={!railOpen} /></div>
          <div className="solve-help-horizontal"><HelpLevelBar level={level} onChange={setLevel} horizontal /></div>
          <div className="solve-tally"><Tally n={fbdCheck.hints + eqCheck.hints} /></div>
          <div className="solve-rail-actions mt-auto flex flex-col gap-3">
            {MOCK && <div className="solve-demo text-[0.7rem] leading-snug text-faint">demo mode: feedback is simulated</div>}
            <Button className="wb w-full !text-[0.95rem]" onClick={saveNow}>
              Save progress
            </Button>
            <Button
              variant={allDone ? "red" : "plain"}
              className="wa w-full !text-[0.95rem]"
              disabledReason={exporting ? "making your PDF…" : allDone ? null : `finish all ${hw.problems.length} problems to export (${doneCount} done)`}
              onClick={exportPdf}
            >
              Export PDF
            </Button>
            <Button variant={problemDone ? "red" : "plain"} className="wc w-full !text-[0.95rem]" disabledReason={nextReason} onClick={next}>
              {index < hw.problems.length - 1 ? "Next question →" : "Finish →"}
            </Button>
          </div>
        </aside>
      </div>

      {zoom && (
        <Modal onClose={() => setZoom(null)} className="!max-w-[56rem]">
          <div className="mb-2 text-[1.2rem]">{zoom.alt || "figure"}</div>
          <FigureImage figure={zoom} className="max-h-[75dvh] w-full" />
        </Modal>
      )}

      {peek && (
        <Modal onClose={() => setPeek(false)} className="!max-w-[46rem]">
          <div className="mb-2 text-[1.2rem]">your diagram</div>
          <div className="hand wb bg-white">
            <StrokeThumb strokes={fbdInk.strokes} underlay={underlay} className="h-auto w-full" />
          </div>
        </Modal>
      )}
    </div>
  );
}
