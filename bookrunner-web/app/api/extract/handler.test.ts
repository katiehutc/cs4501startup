// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { PipelineResult } from "../../../lib/contracts";
import { LlmError } from "../../../lib/llm/client";
import { makeExtractHandler } from "./handler";

const QUESTION: PipelineResult = {
  kind: "question",
  prompt: 'Which firm did you mean by "GS"?',
  options: ["Goldman Sachs", "Guggenheim Securities"],
  attempts: 1,
  trace: [[{ code: "firm_ambiguous", field: "contact.firmText", message: '"GS" could mean more than one firm.' }]],
};

const FAILED: PipelineResult = {
  kind: "failed",
  errors: [{ code: "firm_unknown", field: "contact.firmText", message: '"Acme" is not a firm we know.' }],
  attempts: 3,
  trace: [],
};

const OK: PipelineResult = {
  kind: "ok",
  extraction: {
    contact: { name: "Chris", title: "Analyst", firmText: "Goldman", group: "FIG", city: "New York" },
    chatDate: "2026-10-21",
    referrals: [],
    followUp: null,
    evidence: { "contact.name": "Chris" },
  },
  draft: { contactId: "unsaved", greetingName: "Chris", paragraphs: ["Thanks."], claims: [], signoff: "Best,", removed: [] },
  attempts: 1,
  trace: [],
};

function post(body: unknown): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/extract", { method: "POST", body: text });
}

function runReturning(result: PipelineResult) {
  return vi.fn(async (_note: string) => result);
}

function runThrowing(error: unknown) {
  return vi.fn(async (_note: string): Promise<PipelineResult> => {
    throw error;
  });
}

describe("#48 extract handler results", () => {
  it.each([
    ["ok", OK],
    ["question", QUESTION],
    ["failed", FAILED],
  ] as [string, PipelineResult][])("[ai] returns a %s PipelineResult as JSON with status 200", async (_kind, result) => {
    const response = await makeExtractHandler(runReturning(result))(post({ note: "coffee w/ Chris" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual(result);
  });

  it("[ai] passes the note to the pipeline unchanged", async () => {
    const run = runReturning(OK);
    const note = 'coffee w/ "Chris" @ GS\n  $5bn deal';
    await makeExtractHandler(run)(post({ note }));
    expect(run).toHaveBeenCalledWith(note);
  });

  it("[ai] leaves an empty note to the pipeline, which fails it without an LLM call", async () => {
    const run = runReturning(FAILED);
    const response = await makeExtractHandler(run)(post({ note: "" }));
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("");
  });
});

describe("#48 extract handler firm answers", () => {
  it("[ai] adds the student's firm answer to the note, so the re-run can resolve it", async () => {
    const run = runReturning(OK);
    await makeExtractHandler(run)(post({ note: "coffee w/ Sam, GS, TMT", firmAnswer: "Goldman Sachs" }));
    expect(run).toHaveBeenCalledWith("coffee w/ Sam, GS, TMT\nFirm: Goldman Sachs");
  });

  it("[ai] ignores a blank firm answer", async () => {
    const run = runReturning(OK);
    await makeExtractHandler(run)(post({ note: "coffee w/ Sam", firmAnswer: "  " }));
    expect(run).toHaveBeenCalledWith("coffee w/ Sam");
  });
});

describe("#48 extract handler bad requests", () => {
  it.each([
    ["invalid JSON", "{not json"],
    ["a body that isn't an object", "null"],
    ["a missing note", {}],
    ["a note that isn't a string", { note: 42 }],
    ["a firm answer that isn't a string", { note: "coffee", firmAnswer: 42 }],
  ])("[ai] returns 400 with a readable error for %s, without running the pipeline", async (_label, body) => {
    const run = runReturning(OK);
    const response = await makeExtractHandler(run)(post(body));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: string };
    expect(json.error.length).toBeGreaterThan(0);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("#48 extract handler failures", () => {
  it("[ai] returns 502 with a readable message on an LlmError", async () => {
    const response = await makeExtractHandler(runThrowing(new LlmError("Claude request failed")))(post({ note: "coffee" }));
    expect(response.status).toBe(502);
    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/try again/i);
  });

  it("[ai] returns 500 with a readable message on an unexpected error", async () => {
    const response = await makeExtractHandler(runThrowing(new TypeError("boom")))(post({ note: "coffee" }));
    expect(response.status).toBe(500);
    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/try again/i);
  });

  it.each([
    ["an LlmError", new LlmError('Claude request failed: 401 {"key":"sk-ant-secret"}')],
    ["an unexpected error", new Error("sk-ant-secret in a stack")],
  ])("[ai] never sends the internal message of %s to the client", async (_label, error) => {
    const response = await makeExtractHandler(runThrowing(error))(post({ note: "coffee" }));
    await expect(response.text()).resolves.not.toContain("sk-ant-secret");
  });
});
