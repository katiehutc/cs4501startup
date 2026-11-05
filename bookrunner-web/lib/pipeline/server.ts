
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { ClaudeClient } from "../llm/client";
import { makeExtractor } from "../llm/extract";
import { makeDraftWriter } from "../llm/draft";
import { resolveFirm } from "../firms/resolve";
import { FIRMS } from "../firms/data";
import { validateExtraction, validateDraft } from "./validators";
import type { PipelineDeps } from "./run";

export function makePipelineDeps(): PipelineDeps {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const sdk = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const client = new ClaudeClient(sdk, {
    model: "claude-sonnet-4-6",
  });

  const firmName = (firmId: string): string =>
    FIRMS.find((firm) => firm.id === firmId)?.name ?? "";

  return {
    extract: makeExtractor(client),
    draft: makeDraftWriter(client, firmName),
    validateExtraction,
    validateDraft,
    resolveFirm,
  };
}
