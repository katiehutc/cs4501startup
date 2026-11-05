import "server-only";

import type { LlmClient } from "../contracts";
import { FIRMS } from "../firms/data";
import { resolveFirm } from "../firms/resolve";
import { makeDraftWriter } from "../llm/draft";
import { makeExtractor } from "../llm/extract";
import type { PipelineDeps } from "./run";
import { validateDraft, validateExtraction } from "./validators";

export function makePipelineDeps(client: LlmClient): PipelineDeps {
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
