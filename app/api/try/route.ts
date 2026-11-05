import { NextResponse, type NextRequest } from "next/server";
import { getProblem } from "@/data/problems";
import { aiConfig, getChecker, withDeadline } from "@/lib/ai/checker";
import { DEMO_PROBLEM_ID } from "@/lib/demo";
import { AppError, errorResponse } from "@/lib/errors";
import { decodePng } from "@/lib/image";
import { logRequest } from "@/lib/log";
import { validateCheck } from "@/lib/parse";
import { PROMPT_VERSION } from "@/lib/prompts";
import { allow } from "@/lib/ratelimit";
import type { CheckResponse } from "@/lib/types";

// The landing page's live problem. Open while the notebook is waitlisted, so it is narrow
// on purpose: one hardcoded problem and part, small images, and a rate limit.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PART = "equations" as const;
const MAX_REQUEST_BYTES = 1_500_000;
const PER_VISITOR = { max: 8, windowMs: 10 * 60_000 };
const OVERALL = { max: 60, windowMs: 60_000 };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  const log: Record<string, unknown> = { route: "try", requestId, promptVersion: PROMPT_VERSION, problemId: DEMO_PROBLEM_ID };

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
    if (!allow(`try:${ip}`, PER_VISITOR.max, PER_VISITOR.windowMs) || !allow("try:all", OVERALL.max, OVERALL.windowMs)) {
      throw new AppError("rate_limited", "That's a lot of checks. Take a breath and try again in a few minutes.");
    }
    if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) throw new AppError("payload_too_large", "Request body is too large");
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_BYTES) throw new AppError("payload_too_large", "Request body is too large");

    let body: { imageBase64?: unknown; isFinal?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AppError("invalid_request", "Body must be JSON");
    }
    if (typeof body.imageBase64 !== "string") throw new AppError("invalid_request", "imageBase64 is required");
    const isFinal = body.isFinal === true;

    const problem = getProblem(DEMO_PROBLEM_ID);
    if (!problem) throw new AppError("unknown_problem", "Demo problem is missing");
    const image = decodePng(body.imageBase64);
    Object.assign(log, { part: PART, isFinal, imageBytes: image.bytes });

    const { timeoutMs } = aiConfig();
    const checker = await getChecker();
    Object.assign(log, { provider: checker.provider, model: checker.model });
    const { value, attempts } = await withDeadline(
      timeoutMs,
      async (signal) => {
        const { result, usage } = await checker.check({ image, problem, part: PART, isFinal, signal });
        return { response: validateCheck(result), usage };
      },
      req.signal,
    );

    const res: CheckResponse = value.response;
    logRequest({ ...log, status: 200, attempts, usage: value.usage, correct: res.correct, errorKey: res.errorKey, elapsedMs: Date.now() - started });
    return NextResponse.json(res, { headers: { "x-request-id": requestId } });
  } catch (err) {
    const res = errorResponse(err, requestId);
    logRequest({
      ...log,
      status: res.status,
      errorCode: err instanceof AppError ? err.code : "unexpected",
      errorMessage: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - started,
    });
    return res;
  }
}
