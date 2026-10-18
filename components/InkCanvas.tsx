"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { closedLoop, isCurvingBack } from "@/lib/circle";
import { BOARD_H, BOARD_W, distToStroke, newId, rulerEnd, savedStrokePath, strokeColor, strokeOpacity, strokePath } from "@/lib/ink";
import { pencilHaptic, pencilPose, pencilPrefs } from "@/lib/native";
import type { Ink } from "@/lib/useInk";
import type { DrawingTool, Point, Stroke } from "@/lib/types";

export type Tool = DrawingTool;
export type LoopBox = { x: number; y: number; w: number; h: number }; // board units

type Props = {
  ink: Ink;
  tool?: Tool;
  color?: string;
  size?: number;
  w?: number;
  h?: number;
  placeholder?: string;
  className?: string;
  grid?: boolean;
  /** Closed loop drawn: "circle your answer to finish". */
  onCircle?: (box: LoopBox) => void;
  /** Any new pen stroke (used to mark a check result stale). */
  onStroke?: (s: Stroke) => void;
  /** Eraser touched the board at this point (board units). */
  onEraseAt?: (x: number, y: number) => void;
  /** Fixed drawing under the ink (e.g. the ramp on the diagram board), in board units. */
  background?: React.ReactNode;
  children?: React.ReactNode;
};

const ERASE_RADIUS = 16;

type Sample = Pick<PointerEvent, "clientX" | "clientY" | "pointerType" | "pressure" | "tiltX" | "tiltY"> & {
  altitudeAngle?: number;
  azimuthAngle?: number;
};

/** Pencil angle above the screen (π/2 = upright). Older Safari only reports tiltX/tiltY. */
function altitudeOf(ev: Sample) {
  if (typeof ev.altitudeAngle === "number") return ev.altitudeAngle;
  const r = Math.hypot(Math.tan((ev.tiltX * Math.PI) / 180), Math.tan((ev.tiltY * Math.PI) / 180));
  return r ? Math.atan(1 / r) : Math.PI / 2;
}

/** Direction the Pencil leans, in screen radians. */
function azimuthOf(ev: Sample) {
  if (typeof ev.azimuthAngle === "number") return ev.azimuthAngle;
  return Math.atan2(Math.tan((ev.tiltY * Math.PI) / 180), Math.tan((ev.tiltX * Math.PI) / 180));
}

/** In the iPad app, "Only Draw with Apple Pencil" turned off in Settings lets one finger draw. */
const fingerDraws = () => pencilPrefs()?.prefersPencilOnlyDrawing === false;

/**
 * The writing surface (ui_planning.md §3.3). Strokes render as SVG paths from
 * perfect-freehand, in logical board units, so the board scales without redrawing.
 * Pencil and mouse draw. A finger or palm never draws (unless the iPad app says the user
 * allows finger drawing); two-finger tap = undo, three-finger tap = redo. A hovering
 * Pencil previews the tool under the tip, and the pencil tool shades with tilt and roll.
 */
export default function InkCanvas({
  ink, tool = "pen", color = "#1f1a17", size = 7, w = BOARD_W, h = BOARD_H, placeholder, className = "", grid = true,
  onCircle, onStroke, onEraseAt, background, children,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const live = useRef<SVGPathElement>(null);
  const hover = useRef<SVGEllipseElement>(null);
  const pts = useRef<Point[] | null>(null);
  const activeId = useRef<number | null>(null);
  const activeType = useRef<string | null>(null);
  const rulerAligned = useRef(false);
  const activeStyle = useRef({ tool, color, size, simulatePressure: false });
  const eraseHits = useRef(new Set<string>());
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ max: number; t0: number; moved: boolean } | null>(null);
  // iPad Safari: a Pencil drag also starts page scroll / text selection / the magnifier,
  // which fires pointercancel and kills the stroke. Swallow touch defaults on the board.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.cancelable && e.preventDefault();
    const opts = { passive: false } as const;
    el.addEventListener("touchstart", stop, opts);
    el.addEventListener("touchmove", stop, opts);
    el.addEventListener("touchend", stop, opts);
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("touchend", stop);
    };
  }, []);

  const strokesRef = useRef(ink.strokes);
  strokesRef.current = ink.strokes;

  const [drawing, setDrawing] = useState(false);
  const [curving, setCurving] = useState<{ x: number; y: number } | null>(null);
  const [ruler, setRuler] = useState<[Point, Point] | null>(null);
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const [ghosts, setGhosts] = useState<{ s: Stroke; key: string }[]>([]);
  const prev = useRef<Stroke[]>(ink.strokes);
  const erasedIds = useRef(new Set<string>());

  // Strokes that disappear by undo/clear "lift off" instead of vanishing.
  useLayoutEffect(() => {
    const now = new Set(ink.strokes.map((s) => s.id));
    const gone = prev.current.filter((s) => !now.has(s.id) && !erasedIds.current.has(s.id));
    prev.current = ink.strokes;
    erasedIds.current.clear();
    if (gone.length) {
      const batch = gone.map((s) => ({ s, key: s.id + Math.random() }));
      setGhosts((g) => [...g, ...batch]);
      setTimeout(() => setGhosts((g) => g.filter((x) => !batch.includes(x))), 260);
    }
  }, [ink.strokes]);

  const toBoard = (e: { clientX: number; clientY: number }, pressure: number): Point => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h, pressure];
  };

  // Safari can report pressure 0 on the first Pencil sample; never draw a zero-width stroke.
  const pressure = (ev: { pointerType: string; pressure: number }) =>
    ev.pointerType === "pen" ? Math.max(0.15, ev.pressure || 0.5) : 0.5;

  // The pencil tool shades like graphite: laying the Pencil down widens the stroke, and on
  // Pencil Pro rolling the barrel turns the flat of the lead across the direction of travel.
  const sample = (ev: Sample, prev?: Point): Point => {
    const p = toBoard(ev, pressure(ev));
    if (activeStyle.current.tool !== "pencil" || ev.pointerType !== "pen") return p;
    let k = 1 + 1.4 * Math.max(0, (0.7 - altitudeOf(ev)) / 0.7);
    if (pencilPose.roll != null && prev) {
      const nib = azimuthOf(ev) + pencilPose.roll;
      const dir = Math.atan2(p[1] - prev[1], p[0] - prev[0]);
      k *= 0.75 + 0.5 * Math.abs(Math.sin(dir - nib));
    }
    p[2] = Math.min(1, p[2] * k);
    return p;
  };

  /** Hover preview: the nib (or eraser ring) under a hovering Pencil, fainter as it lifts. */
  const showHover = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = hover.current;
    if (!el) return;
    const on = e.pointerType === "pen" && e.buttons === 0 && activeId.current == null && (pencilPrefs()?.prefersHoverToolPreview ?? true);
    if (!on) return el.setAttribute("visibility", "hidden");
    const [x, y] = toBoard(e, 0.5);
    const eraser = tool === "eraser";
    const r = eraser ? ERASE_RADIUS : tool === "ruler" ? 3 : Math.max(2, (tool === "pencil" ? size * 0.6 : size) / 2);
    const roll = tool === "pencil" ? pencilPose.roll : null;
    el.setAttribute("cx", String(x));
    el.setAttribute("cy", String(y));
    el.setAttribute("rx", String(r));
    el.setAttribute("ry", String(roll == null ? r : r * 0.45));
    el.setAttribute("transform", roll == null ? "" : `rotate(${((azimuthOf(e.nativeEvent) + roll) * 180) / Math.PI} ${x} ${y})`);
    el.setAttribute("fill", eraser ? "none" : strokeColor({ color }));
    el.setAttribute("stroke", eraser ? "#6b6461" : "none");
    el.setAttribute("opacity", String(0.6 - 0.35 * (pencilPose.z ?? 0.5)));
    el.setAttribute("visibility", "visible");
  };

  /** Pencil Pro haptic at a board point. */
  const haptic = (kind: "alignment" | "pathCompleted", p: Point) => {
    const r = svg.current?.getBoundingClientRect();
    if (r) pencilHaptic(kind, r.left + (p[0] / w) * r.width, r.top + (p[1] / h) * r.height);
  };

  const eraseAt = (p: Point) => {
    onEraseAt?.(p[0], p[1]);
    const hit = strokesRef.current.filter((s) => !eraseHits.current.has(s.id) && distToStroke(s, p[0], p[1]) < ERASE_RADIUS + (s.size ?? 7) / 2);
    if (hit.length) {
      hit.forEach((s) => eraseHits.current.add(s.id));
      setErasing(new Set(eraseHits.current));
    }
  };

  const cancelStroke = () => {
    pts.current = null;
    activeId.current = null;
    live.current?.setAttribute("d", "");
    setDrawing(false);
    setCurving(null);
    setRuler(null);
  };

  /** Drop the stroke or erase in progress without committing it. */
  const abortStroke = () => {
    cancelStroke();
    eraseHits.current.clear();
    setErasing(new Set());
  };

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    hover.current?.setAttribute("visibility", "hidden");
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const n = touches.current.size;
      if (n === 1) gesture.current = { max: 1, t0: performance.now(), moved: false };
      else {
        if (gesture.current) gesture.current.max = Math.max(gesture.current.max, n);
        // A second finger turns a finger stroke into an undo/redo tap.
        if (activeId.current != null && activeType.current === "touch") abortStroke();
      }
      // Fingers and palms only count toward undo/redo taps, unless finger drawing is on.
      if (n !== 1 || !fingerDraws()) return;
    }
    if (activeId.current != null || e.button !== 0) return;
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    activeId.current = e.pointerId;
    activeType.current = e.pointerType;
    activeStyle.current = { tool, color, size, simulatePressure: e.pointerType !== "pen" };
    rulerAligned.current = false;
    const p = sample(e.nativeEvent);
    if (tool === "eraser") {
      erasedIds.current.clear();
      eraseHits.current.clear();
      eraseAt(p);
      return;
    }
    pts.current = [p];
    live.current?.setAttribute("fill", strokeColor({ color }));
    live.current?.setAttribute("opacity", String(strokeOpacity({ tool })));
    live.current?.setAttribute("d", strokePath([p], activeStyle.current.simulatePressure, activeStyle.current));
    setDrawing(true);
  };

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    showHover(e);
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      const t = touches.current.get(e.pointerId)!;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12 && gesture.current) gesture.current.moved = true;
    }
    if (activeId.current !== e.pointerId) return;
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [e.nativeEvent];
    const style = activeStyle.current;
    if (style.tool === "eraser") {
      events.forEach((ev) => eraseAt(toBoard(ev, 0.5)));
      return;
    }
    if (!pts.current) return;
    let shown = pts.current;
    if (style.tool === "ruler") {
      const start = pts.current[0];
      const end = rulerEnd(start, toBoard(e, 0.5), e.shiftKey);
      pts.current = shown = [start, end];
      setRuler([start, end]);
      // Tick the Pencil Pro as the line passes horizontal, vertical or 45°.
      const deg = Math.abs((Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI) % 45;
      const aligned = Math.min(deg, 45 - deg) < 1 && Math.hypot(end[0] - start[0], end[1] - start[1]) > 20;
      if (aligned && !rulerAligned.current) haptic("alignment", end);
      rulerAligned.current = aligned;
    } else {
      for (const ev of events) pts.current.push(sample(ev, pts.current[pts.current.length - 1]));
      // Predicted samples draw ahead of the tip to hide latency; they are never saved.
      const predicted = e.nativeEvent.getPredictedEvents?.() ?? [];
      if (predicted.length) {
        const last = pts.current[pts.current.length - 1];
        shown = [...pts.current, ...predicted.map((ev) => sample(ev, last))];
      }
    }
    live.current?.setAttribute("d", strokePath(shown, style.simulatePressure, style));
    const last = pts.current[pts.current.length - 1];
    const c = style.tool !== "ruler" && isCurvingBack(pts.current);
    setCurving(c ? { x: last[0], y: last[1] } : null);
  };

  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") {
      touches.current.delete(e.pointerId);
      const g = gesture.current;
      if (touches.current.size === 0 && g) {
        if (!g.moved && performance.now() - g.t0 < 350) {
          if (g.max === 2) ink.undo();
          if (g.max === 3) ink.redo();
        }
        gesture.current = null;
      }
    }
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;

    const style = activeStyle.current;
    if (style.tool === "eraser") {
      eraseAt(toBoard(e, 0.5));
      if (eraseHits.current.size) {
        eraseHits.current.forEach((id) => erasedIds.current.add(id));
        ink.commit(strokesRef.current.filter((s) => !eraseHits.current.has(s.id)));
        eraseHits.current.clear();
        setErasing(new Set());
      }
      return;
    }
    if (style.tool === "ruler" && pts.current) {
      pts.current = [pts.current[0], rulerEnd(pts.current[0], toBoard(e, 0.5), e.shiftKey)];
    }
    const points = pts.current;
    cancelStroke();
    if (!points || points.length < 2) {
      if (points?.length === 1) points.push([points[0][0] + 0.5, points[0][1] + 0.5, points[0][2]]); // a dot
      else return;
    }
    const stroke: Stroke = { id: newId(), points, ...style };
    ink.commit([...strokesRef.current, stroke]);
    onStroke?.(stroke);
    const loop = style.tool !== "ruler" && closedLoop(points);
    if (loop && onCircle) {
      onCircle(loop);
      haptic("pathCompleted", points[points.length - 1]);
    }
  };

  const empty = ink.strokes.length === 0 && !drawing;

  return (
    <div
      className={`relative select-none ${grid ? "grid-paper" : "bg-white"} ${className}`}
      style={{ aspectRatio: `${w} / ${h}`, touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      <svg
        ref={svg}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 h-full w-full"
        style={{ touchAction: "none", cursor: tool === "eraser" ? "cell" : "crosshair" }}
        aria-label="Canvas. Write with Apple Pencil or a mouse."
        role="img"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => {
          touches.current.delete(e.pointerId);
          gesture.current = null;
          if (activeId.current === e.pointerId) abortStroke();
        }}
        onPointerLeave={() => hover.current?.setAttribute("visibility", "hidden")}
      >
        {background}
        {ink.strokes.map((s) => (
          <path key={s.id} d={savedStrokePath(s)} fill={strokeColor(s)} opacity={strokeOpacity(s)} className={erasing.has(s.id) ? "ink-fade" : ""} />
        ))}
        {ghosts.map(({ s, key }) => (
          <path key={key} d={savedStrokePath(s)} fill={strokeColor(s)} opacity={strokeOpacity(s)} className="ink-lift" />
        ))}
        <path ref={live} />
        <ellipse ref={hover} visibility="hidden" strokeWidth={1.5} pointerEvents="none" aria-hidden />
        {ruler && <RulerGuide start={ruler[0]} end={ruler[1]} />}
      </svg>
      {placeholder && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center text-faint transition-opacity duration-300"
          style={{ opacity: empty ? 1 : 0, fontSize: "1.05rem" }}
        >
          {placeholder}
        </div>
      )}
      {curving && (
        <div
          className="pointer-events-none absolute whitespace-nowrap text-[0.75rem] text-tomato-2 bubble"
          style={{ left: `${(curving.x / w) * 100}%`, top: `${(curving.y / h) * 100}%`, translate: "14px -34px" }}
        >
          check this?
        </div>
      )}
      {children}
    </div>
  );
}

/** Graduations are a drawing guide only and never become saved or graded ink. */
function RulerGuide({ start, end }: { start: Point; end: Point }) {
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI;
  return (
    <g transform={`translate(${start[0]} ${start[1]}) rotate(${angle})`} pointerEvents="none" aria-hidden>
      <rect x={0} y={12} width={length} height={28} rx={3} fill="#fff3a8" fillOpacity={0.75} stroke="#9a918d" />
      {Array.from({ length: Math.min(200, Math.floor(length / 10) + 1) }, (_, i) => (
        <path key={i} d={`M${i * 10} 12 v${i % 5 === 0 ? 16 : 8}`} stroke="#6b6461" strokeWidth={1} />
      ))}
    </g>
  );
}
