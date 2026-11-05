// Shared contracts (planning/product/context.md §6). DO NOT change without telling the team.

// ---------- Ink ----------
export type Point = [x: number, y: number, pressure: number];
export type DrawingTool = "pen" | "pencil" | "ruler" | "eraser";
// Optional style fields keep existing saved boards compatible (black, size-7 pen).
export type Stroke = {
  id: string;
  points: Point[];
  tool: DrawingTool;
  color?: string;
  size?: number;
  simulatePressure?: boolean;
};

// ---------- Problems ----------
export type ProblemPart = "fbd" | "equations";

/** "inclined_plane" problems get the ramp drawn on the diagram board; "general" ones use diagramSvg. */
export type ProblemKind = "inclined_plane" | "general";

/** A picture that belongs to the problem statement (e.g. a figure cropped from an uploaded worksheet). */
export type Figure = {
  src: string; // data: URL, https URL, or "sb:<path>" in the worksheet-figures storage bucket
  alt?: string;
};

export type Problem = {
  id: string;
  title: string; // "Block on a frictionless ramp"
  text: string; // full problem statement
  givenValues: Record<string, string>; // { m: "5 kg", θ: "30°" }
  checkToken?: string; // Server-signed reference for imported homework.
  diagramSvg?: string; // optional inline SVG of the setup, in board units (1000×640), drawn under the diagram
  type: ProblemKind;
  topic?: string; // "Kinematics"
  parts?: ProblemPart[]; // default ["fbd", "equations"]; ["equations"] for problems with no diagram step
  boardHint?: string; // faint prompt on the empty diagram board
  figures?: Figure[];
  reference: {
    fbd: string; // expected forces + directions, plain text
    equations: string; // expected step-by-step solution
    finalAnswer: string; // "a = 4.9 m/s² down the ramp"
  };
};

// ---------- Check ----------
export type HelpLevel = 0 | 1 | 2 | 3; // Mark | Hint | Explain | Answer

export type CheckRequest = {
  imageBase64: string; // PNG, no data: prefix
  problemId: string;
  part: ProblemPart;
  problemToken?: string;
  isFinal?: boolean; // true when triggered by circle-to-finish
};

export type BBox = { x: number; y: number; w: number; h: number }; // fractions 0–1 of the image

export type CheckResponse = {
  correct: boolean;
  errorStep: string | null; // "Normal force drawn vertical"
  bbox: BBox | null; // where to draw the red circle
  mark: string | null; // ≤ 6 words, shown in red
  hint: string | null; // level 1
  explanation: string | null; // level 2
  fullSolution: string | null; // level 3
  errorKey: string | null; // stable id for the mistake, used by the tamatar
};

// ---------- Extract ----------
/** Where an extracted problem's figure sits in the upload: 1-based page, corners as fractions of the page. */
export type FigureBox = { problemIndex: number; page: number; x0: number; y0: number; x1: number; y1: number; caption: string };
export type ExtractResponse = { problems: Problem[]; unsupported: string[]; figures?: FigureBox[] };

// ---------- Tomato ----------
export type TomatoState = 0 | 1 | 2 | 3; // happy | watchful | concerned | worried (it worries, it doesn't rot)
