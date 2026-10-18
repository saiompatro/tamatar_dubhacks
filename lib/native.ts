// Bridge to the iPad app (ios/). The app injects window.__tamatarNative and sends
// "tamatar:pencil" events for the Pencil features Pointer Events can't see: double-tap,
// squeeze, hover height and barrel roll. In a normal browser every export is a no-op.

export type PencilAction =
  | "ignore" | "switchEraser" | "switchPrevious" | "showColorPalette"
  | "showInkAttributes" | "showContextualPalette" | "runSystemShortcut";

export type PencilPrefs = {
  /** Settings → Apple Pencil → "Only Draw with Apple Pencil". False lets a finger draw. */
  prefersPencilOnlyDrawing: boolean;
  prefersHoverToolPreview: boolean;
  tapAction: PencilAction;
  squeezeAction: PencilAction;
};

/** x/y are viewport (client) pixels of the hovering tip, when the Pencil reports one. */
export type PencilEvent =
  | { type: "tap"; action: PencilAction; x?: number; y?: number }
  | { type: "squeeze"; action: PencilAction; phase: "began" | "changed" | "ended" | "cancelled"; x?: number; y?: number }
  | { type: "pose"; touching: boolean; z?: number; roll?: number }
  | { type: "prefs"; prefs: PencilPrefs };

type NativeWindow = Window & {
  __tamatarNative?: { platform: string; prefs: PencilPrefs };
  webkit?: { messageHandlers?: { tamatar?: { postMessage(message: unknown): void } } };
};

const win = () => (typeof window === "undefined" ? undefined : (window as NativeWindow));

export const pencilPrefs = (): PencilPrefs | null => win()?.__tamatarNative?.prefs ?? null;

/** Latest hover height (0 = touching … 1 = farthest) and barrel roll in radians (Pencil Pro). */
export const pencilPose: { z: number | null; roll: number | null } = { z: null, roll: null };

export function onPencil(fn: (e: PencilEvent) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<PencilEvent>).detail);
  window.addEventListener("tamatar:pencil", handler);
  return () => window.removeEventListener("tamatar:pencil", handler);
}

if (typeof window !== "undefined") {
  onPencil((e) => {
    if (e.type !== "pose") return;
    pencilPose.z = e.z ?? null;
    pencilPose.roll = e.roll ?? null;
  });
}

/** Pencil Pro haptic at a viewport point; silent on every other Pencil and in browsers. */
export function pencilHaptic(kind: "alignment" | "pathCompleted", x: number, y: number) {
  win()?.webkit?.messageHandlers?.tamatar?.postMessage({ type: "haptic", kind, x, y });
}
