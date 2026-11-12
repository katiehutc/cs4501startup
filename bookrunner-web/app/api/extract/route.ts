import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { LlmClient } from "@/lib/contracts";
import { TODAY } from "@/lib/dates";
import { ClaudeClient, LlmError } from "@/lib/llm/client";
import { MAX_NOTE_CHARS } from "@/lib/limits";
import { CLAUDE_MODEL, LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from "@/lib/llm/model";
import { runPipeline } from "@/lib/pipeline/run";
import { makePipelineDeps } from "@/lib/pipeline/server";
import { makeFakeLlm } from "./fake-llm";

class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured");
    this.name = "MissingApiKeyError";
  }
}

function makeClient(note: string): LlmClient {
  if (process.env.LLM_FAKE === "1") {
    return makeFakeLlm(note);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      completeJson: async () => {
        throw new MissingApiKeyError();
      },
    };
  }
  return new ClaudeClient(new Anthropic({ apiKey, timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES }), { model: CLAUDE_MODEL });
}

async function readNote(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json();
    const note = (body as { note?: unknown } | null)?.note;
    return typeof note === "string" && note.trim() ? note : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const note = await readNote(request);
  if (note === null) {
    return NextResponse.json({ error: "Please provide some notes." }, { status: 400 });
  }
  if (note.length > MAX_NOTE_CHARS) {
    return NextResponse.json(
      { error: `Those notes are too long. Keep them under ${MAX_NOTE_CHARS.toLocaleString("en-US")} characters.` },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await runPipeline(note, TODAY, makePipelineDeps(makeClient(note))));
  } catch (error) {
    // Internal messages can hold raw API responses, so they stay in the server log.
    console.error("Extraction API failed:", error);
    if (error instanceof LlmError) {
      return NextResponse.json({ error: "We couldn't reach Claude. Your notes are safe, so try again." }, { status: 502 });
    }
    return NextResponse.json({ error: "Unable to process notes right now. Try again." }, { status: 500 });
  }
}
