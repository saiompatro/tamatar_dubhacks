"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { INK_COLORS } from "@/lib/ink";
import { wiggle } from "@/lib/motion";
import { onPencil, type PencilEvent } from "@/lib/native";
import type { Ink } from "@/lib/useInk";
import type { Tool } from "./InkCanvas";

const ScientificCalculator = dynamic(() => import("./ScientificCalculator"), { ssr: false });

const ICON: Record<string, React.ReactNode> = {
  pen: <path d="M5 19 L7 13 L16 4 L20 8 L11 17 Z M7 13 L11 17 M14 6 L18 10" />,
  pencil: <path d="M4 20 L5 14 L15 4 Q16 3 17 4 L20 7 Q21 8 20 9 L10 19 Z M5 14 L10 19 M13 6 L18 11 M4 20 L7 19 M7 15 L16 6" />,
  ruler: <path d="M3 15 L15 3 L21 9 L9 21 Z M6 12 L9 15 M9 9 L11 11 M12 6 L15 9 M15 12 L17 14" />,
  calculator: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 5 H16 V9 H8 Z M8 13 H9 M12 13 H13 M16 13 H16.1 M8 17 H9 M12 17 H13 M16 17 H16.1" /></>,
  eraser: <path d="M4 16 L12 8 L18 14 L12 20 L7 20 Z M8 12 L14 18 M12 20 L20 20" />,
  undo: <path d="M8 6 L4 10 L8 14 M4 10 C10 9 16 9 18 13 C19 16 17 19 13 19" />,
  redo: <path d="M16 6 L20 10 L16 14 M20 10 C14 9 8 9 6 13 C5 16 7 19 11 19" />,
  clear: <path d="M5 7 L19 7 M9 7 L9 4 L15 4 L15 7 M7 7 L8 20 L16 20 L17 7 M10.5 10 L10.5 17 M13.5 10 L13.5 17" />,
};

function Tb({ name, label, active, onClick, disabled, danger }: { name: string; label: string; active?: boolean; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={() => {
        onClick();
        wiggle(ref.current?.firstElementChild ?? null);
      }}
      className={`flex h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 transition-colors disabled:opacity-30 ${
        active ? "bg-blush" : ""
      } ${danger ? "bg-tomato px-3 text-white" : ""}`}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICON[name]}
      </svg>
      {danger && <span className="text-[0.8rem]">clear all?</span>}
    </button>
  );
}

const SIZES = [{ value: 3, label: "Fine" }, { value: 7, label: "Medium" }, { value: 11, label: "Thick" }];

/** Shared pencil case for homework and standalone boards. */
export default function Toolbar({ ink, tool, setTool: setToolRaw, color, setColor, size, setSize }: {
  ink: Ink; tool: Tool; setTool: (t: Tool) => void;
  color: string; setColor: (color: string) => void;
  size: number; setSize: (size: number) => void;
}) {
  const [arm, setArm] = useState(false);
  const [palette, setPalette] = useState(false);
  const [floating, setFloating] = useState<{ x: number; y: number } | null>(null);
  const [calculator, setCalculator] = useState(false);
  const [calculatorLoaded, setCalculatorLoaded] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const { undo, redo } = ink;

  // Remember the tool before the current one, for Pencil double-tap "switch to previous".
  const toolRef = useRef(tool);
  const prevTool = useRef<Tool>(tool === "eraser" ? "pen" : "eraser");
  toolRef.current = tool;
  const setTool = useRef((t: Tool) => {
    if (t !== toolRef.current) prevTool.current = toolRef.current;
    setToolRaw(t);
  }).current;

  // Apple Pencil double-tap and squeeze (iPad app), doing what the user chose in Settings → Apple Pencil.
  useEffect(() => onPencil((e: PencilEvent) => {
    if (e.type === "tap" || (e.type === "squeeze" && e.phase === "ended")) {
      const current = toolRef.current;
      switch (e.action) {
        case "switchEraser":
          setTool(current === "eraser" ? (prevTool.current === "eraser" ? "pen" : prevTool.current) : "eraser");
          break;
        case "switchPrevious":
          setTool(prevTool.current === current ? (current === "pen" ? "eraser" : "pen") : prevTool.current);
          break;
        case "showColorPalette":
          setPalette((open) => !open);
          break;
        case "showInkAttributes":
        case "showContextualPalette":
          setFloating((open) => (open ? null : { x: e.x ?? window.innerWidth / 2, y: e.y ?? window.innerHeight / 2 }));
          break;
      }
    }
  }), [setTool]);
  useEffect(() => {
    if (!arm) return;
    const t = setTimeout(() => setArm(false), 3000);
    return () => clearTimeout(t);
  }, [arm]);

  useEffect(() => {
    if (!palette) return;
    const close = (e: PointerEvent) => {
      if (!paletteRef.current?.contains(e.target as Node)) setPalette(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [palette]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return e.shiftKey ? redo() : undo();
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const shortcuts: Record<string, Tool> = { p: "pen", b: "pencil", r: "ruler", e: "eraser" };
      if (shortcuts[e.key.toLowerCase()]) setTool(shortcuts[e.key.toLowerCase()]);
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [undo, redo, setTool]);

  return (
    <div className="relative flex shrink-0 flex-col items-center gap-1">
      <div role="group" aria-label="Drawing tools" className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-2xl border-[2.5px] border-ink bg-white/95 px-1.5 py-0.5 shadow-[3px_4px_0_#f6d9d5]" onPointerDown={(e) => e.stopPropagation()}>
        <Tb name="pen" label="Pen (P)" active={tool === "pen"} onClick={() => setTool("pen")} />
        <Tb name="pencil" label="Pencil (B)" active={tool === "pencil"} onClick={() => setTool("pencil")} />
        <Tb name="ruler" label="Ruler (R)" active={tool === "ruler"} onClick={() => setTool("ruler")} />
        <Tb name="eraser" label="Eraser (E)" active={tool === "eraser"} onClick={() => setTool("eraser")} />
        <div ref={paletteRef} className="relative" onKeyDown={(e) => e.key === "Escape" && setPalette(false)}>
          <button type="button" aria-label="Ink colour" aria-expanded={palette} onClick={() => setPalette(!palette)} title="Ink colour" className="flex h-[44px] w-[44px] items-center justify-center rounded-full hover:bg-blush">
            <span className="h-[22px] w-[22px] rounded-full border-2 border-white ring-1 ring-ink" style={{ background: color }} />
          </button>
          {palette && (
            <div role="group" aria-label="Ink colours" className="hand wb absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 bg-white p-1 shadow-[3px_4px_0_#f6d9d5]">
              {INK_COLORS.map((c) => (
                <button key={c.value} type="button" title={c.name} aria-label={`${c.name} ink`} aria-pressed={color === c.value} onClick={() => { setColor(c.value); setPalette(false); if (tool === "eraser") setTool("pen"); }} className="flex h-[44px] w-[44px] items-center justify-center rounded-full">
                  <span className={`flex h-[28px] w-[28px] items-center justify-center rounded-full border-2 border-white text-white ${color === c.value ? "ring-2 ring-ink" : "ring-1 ring-rule"}`} style={{ background: c.value }}>
                    {color === c.value && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 8 L6 11 L13 4" /></svg>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select aria-label="Stroke width" value={size} onChange={(e) => setSize(Number(e.target.value))} className="h-[44px] max-w-[88px] rounded-lg border border-rule bg-white px-1 text-[0.8rem]">
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="mx-1 h-6 w-px bg-rule" aria-hidden />
        <Tb name="undo" label="undo (⌘Z)" onClick={ink.undo} disabled={!ink.canUndo} />
        <Tb name="redo" label="redo (⇧⌘Z)" onClick={ink.redo} disabled={!ink.canRedo} />
        <Tb
          name="clear"
          label={arm ? "tap again to clear" : "clear"}
          danger={arm}
          disabled={!ink.strokes.length && !arm}
          onClick={() => {
            if (arm) {
              ink.clear();
              setArm(false);
            } else setArm(true);
          }}
        />
        <Tb name="calculator" label="Scientific calculator" active={calculator} onClick={() => { setCalculatorLoaded(true); setCalculator(!calculator); }} />
      </div>
      {tool === "ruler" && <p className="text-center text-[0.75rem] text-muted">Drag a straight line · hold Shift to snap to 15°</p>}
      {calculatorLoaded && <ScientificCalculator open={calculator} onClose={() => setCalculator(false)} />}
      {floating && createPortal(
        <PencilPalette
          at={floating}
          onClose={() => setFloating(null)}
          ink={ink} tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
        />,
        document.body,
      )}
    </div>
  );
}

/**
 * Contextual palette that opens at the Pencil tip on squeeze (Pencil Pro) or double-tap,
 * when the user set that action to "Show contextual palette" / "Show ink attributes".
 */
function PencilPalette({ at, onClose, ink, tool, setTool, color, setColor, size, setSize }: {
  at: { x: number; y: number }; onClose: () => void;
  ink: Ink; tool: Tool; setTool: (t: Tool) => void;
  color: string; setColor: (color: string) => void;
  size: number; setSize: (size: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = 300, H = 170;
  const left = Math.max(8, Math.min(at.x - W / 2, window.innerWidth - W - 8));
  const top = at.y + 28 + H < window.innerHeight ? at.y + 28 : Math.max(8, at.y - 28 - H);

  useEffect(() => {
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const pick = (t: Tool) => { setTool(t); onClose(); };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pencil palette"
      className="hand wb fixed z-50 flex flex-col gap-1 bg-white p-2 shadow-[3px_4px_0_#f6d9d5]"
      style={{ left, top, width: W }}
    >
      <div className="flex items-center justify-between">
        <Tb name="pen" label="Pen" active={tool === "pen"} onClick={() => pick("pen")} />
        <Tb name="pencil" label="Pencil" active={tool === "pencil"} onClick={() => pick("pencil")} />
        <Tb name="ruler" label="Ruler" active={tool === "ruler"} onClick={() => pick("ruler")} />
        <Tb name="eraser" label="Eraser" active={tool === "eraser"} onClick={() => pick("eraser")} />
        <Tb name="undo" label="undo" onClick={ink.undo} disabled={!ink.canUndo} />
        <Tb name="redo" label="redo" onClick={ink.redo} disabled={!ink.canRedo} />
      </div>
      <div role="group" aria-label="Ink colours" className="flex items-center justify-between px-1">
        {INK_COLORS.map((c) => (
          <button key={c.value} type="button" aria-label={`${c.name} ink`} aria-pressed={color === c.value}
            onClick={() => { setColor(c.value); if (tool === "eraser") setTool("pen"); onClose(); }}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full">
            <span className={`h-[26px] w-[26px] rounded-full border-2 border-white ${color === c.value ? "ring-2 ring-ink" : "ring-1 ring-rule"}`} style={{ background: c.value }} />
          </button>
        ))}
      </div>
      <div role="group" aria-label="Stroke width" className="flex gap-1">
        {SIZES.map((s) => (
          <button key={s.value} type="button" aria-pressed={size === s.value} onClick={() => setSize(s.value)}
            className={`flex h-[40px] flex-1 items-center justify-center gap-2 rounded-full text-[0.8rem] ${size === s.value ? "bg-blush" : ""}`}>
            <span className="rounded-full bg-ink" style={{ width: s.value + 2, height: s.value + 2 }} aria-hidden />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
