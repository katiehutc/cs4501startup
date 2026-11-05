
import type { PipelineResult } from "./contracts";
import {
  toCaptureResult,
  type CapturePipelineResult,
} from "./pipeline/capture-adapter";

export type CaptureExtractionResult = CapturePipelineResult;

export const SAMPLE_NOTE =
  "talked w/ Chris, 1st yr analyst GS FIG NY. good convo about the group. said follow up in 3 wks and email his associate Dana";

export async function extractFromNotes(
  text: string
): Promise<CaptureExtractionResult> {
  if (!text.trim()) {
    throw new Error("Please enter some notes first.");
  }

  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note: text }),
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);

    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "Unable to extract notes right now.";

    throw new Error(message);
  }

  const pipeline: PipelineResult = await response.json();

  return toCaptureResult(pipeline);
}
