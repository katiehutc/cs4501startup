import type { PipelineResult } from "../../../lib/contracts";
import { LlmError } from "../../../lib/llm/client";

export type PipelineRun = (note: string) => Promise<PipelineResult>;
export type ExtractHandler = (request: Request) => Promise<Response>;

const BAD_REQUEST = "Send a JSON body with a note, and a firmAnswer only as text.";
const LLM_FAILED = "We couldn't reach Claude. Your notes are safe, so try again.";
const UNEXPECTED = "Something went wrong on our side. Your notes are safe, so try again.";

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// The firm line goes in the note so the extractor can use it and the validator can find it as evidence.
function noteFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { note, firmAnswer } = body as Record<string, unknown>;
  if (typeof note !== "string" || (firmAnswer !== undefined && typeof firmAnswer !== "string")) {
    return null;
  }
  return firmAnswer?.trim() ? `${note}\nFirm: ${firmAnswer.trim()}` : note;
}

export function makeExtractHandler(run: PipelineRun): ExtractHandler {
  return async (request) => {
    const note = noteFromBody(await readBody(request));
    if (note === null) {
      return Response.json({ error: BAD_REQUEST }, { status: 400 });
    }
    try {
      return Response.json(await run(note));
    } catch (error) {
      // Internal messages can hold raw API responses, so they never go to the browser.
      const failedAtLlm = error instanceof LlmError;
      return Response.json({ error: failedAtLlm ? LLM_FAILED : UNEXPECTED }, { status: failedAtLlm ? 502 : 500 });
    }
  };
}
