import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from "../../../lib/llm/model";

const mocks = vi.hoisted(() => ({
  anthropicCtor: vi.fn(),
  runPipeline: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: vi.fn() };
    constructor(options: unknown) {
      mocks.anthropicCtor(options);
    }
  },
}));

vi.mock("../../../lib/pipeline/run", () => ({ runPipeline: mocks.runPipeline }));
vi.mock("../../../lib/pipeline/server", () => ({ makePipelineDeps: () => ({}) }));

import { POST } from "./route";

function request(note: string): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

describe("POST /api/extract Claude client settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("LLM_FAKE", "");
    mocks.runPipeline.mockResolvedValue({ kind: "failed", errors: [], attempts: 1, trace: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("[ai] gives up on a slow Claude request instead of hanging", async () => {
    await POST(request("Coffee with Sam from GS TMT"));
    expect(mocks.anthropicCtor).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES }),
    );
  });

  it("[ai] keeps the timeout short enough for someone waiting on the page", () => {
    expect(LLM_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
    expect(LLM_MAX_RETRIES).toBeLessThanOrEqual(1);
  });
});
