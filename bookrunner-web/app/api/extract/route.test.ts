
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineResult } from "../../../lib/contracts";
import { TODAY } from "../../../lib/dates";
import { LlmError } from "../../../lib/llm/client";

const mocks = vi.hoisted(() => ({
  runPipeline: vi.fn(),
  makeDeps: vi.fn(),
}));

vi.mock("../../../lib/pipeline/run", () => ({
  runPipeline: mocks.runPipeline,
}));

vi.mock("../../../lib/pipeline/server", () => ({
  makePipelineDeps: mocks.makeDeps,
}));

import { POST } from "./route";

function request(body: unknown): Request {
  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("#48 POST /api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.makeDeps.mockReturnValue({});
  });

  it("[ai] runs the pipeline for a valid note", async () => {
    const result: PipelineResult = {
      kind: "question",
      prompt: 'Which firm did you mean by "GS"?',
      options: ["Goldman Sachs", "Guggenheim Securities"],
      attempts: 1,
      trace: [],
    };

    mocks.runPipeline.mockResolvedValue(result);

    const response = await POST(
      request({ note: "Talked with Alex at GS" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mocks.runPipeline).toHaveBeenCalledWith(
      "Talked with Alex at GS",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      expect.anything(),
    );
  });

  it("[ai] rejects an empty note", async () => {
    const response = await POST(request({ note: "   " }));

    expect(response.status).toBe(400);
    expect(mocks.runPipeline).not.toHaveBeenCalled();
  });

  it("[ai] rejects invalid request bodies", async () => {
    const response = await POST(request({ note: 123 }));

    expect(response.status).toBe(400);
    expect(mocks.runPipeline).not.toHaveBeenCalled();
  });

  it("[ai] handles pipeline errors without exposing details", async () => {
    mocks.runPipeline.mockRejectedValue(
      new Error("Secret API key: example-secret"),
    );

    const response = await POST(
      request({ note: "Talked with Alex at Goldman Sachs" }),
    );

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBeDefined();
    expect(JSON.stringify(body)).not.toContain("example-secret");
  });

  it("[ai] passes the demo's fixed date, so saved tasks line up with the Today page", async () => {
    mocks.runPipeline.mockResolvedValue({ kind: "failed", errors: [], attempts: 3, trace: [] });
    await POST(request({ note: "Talked with Alex at Goldman Sachs" }));
    expect(mocks.runPipeline).toHaveBeenCalledWith(expect.any(String), TODAY, expect.anything());
  });

  it("[ai] returns 502 with a readable message when the LLM fails", async () => {
    mocks.runPipeline.mockRejectedValue(new LlmError('Claude request failed: 401 {"key":"example-secret"}'));
    const response = await POST(request({ note: "Talked with Alex at Goldman Sachs" }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toMatch(/try again/i);
    expect(JSON.stringify(body)).not.toContain("example-secret");
  });

  it("[ai] returns 400 rather than 500 for a body that isn't JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/extract", { method: "POST", body: "{not json" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.runPipeline).not.toHaveBeenCalled();
  });
});
