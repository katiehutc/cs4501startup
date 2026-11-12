import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "../contracts";
import { ClaudeClient, FakeLlmClient, LlmError } from "./client";

const SCHEMA = { type: "object", properties: { name: { type: "string" } } };

type FakeBlock = { type: "text"; text: string } | { type: "thinking"; thinking: string };
interface FakeMessage {
  content: FakeBlock[];
  stop_reason: string | null;
}

function textMessage(text: string, stopReason = "end_turn"): FakeMessage {
  return { content: [{ type: "text", text }], stop_reason: stopReason };
}

function fakeSdk(create: (params: unknown) => Promise<FakeMessage>) {
  const spy = vi.fn(create);
  return { sdk: { messages: { create: spy } }, spy };
}

function clientReturning(message: FakeMessage): ClaudeClient {
  return new ClaudeClient(fakeSdk(async () => message).sdk, { model: "test-model" });
}

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to reject");
}

describe("#43 FakeLlmClient", () => {
  it("[ai] can be used anywhere an LlmClient is expected", async () => {
    const client: LlmClient = new FakeLlmClient([{ ok: true }]);
    await expect(client.completeJson("s", "u", SCHEMA)).resolves.toEqual({ ok: true });
  });

  it("[ai] returns queued responses in order, for bad-then-good scripts", async () => {
    const client = new FakeLlmClient([{ attempt: "bad" }, { attempt: "good" }]);
    await expect(client.completeJson("s", "u", SCHEMA)).resolves.toEqual({ attempt: "bad" });
    await expect(client.completeJson("s", "u", SCHEMA)).resolves.toEqual({ attempt: "good" });
  });

  it("[ai] records the system prompt, user prompt and schema of every call", async () => {
    const client = new FakeLlmClient([{}, {}]);
    await client.completeJson("sys 1", "user 1", SCHEMA);
    await client.completeJson("sys 2", "user 2", {});
    expect(client.calls).toEqual([
      { system: "sys 1", user: "user 1", schema: SCHEMA },
      { system: "sys 2", user: "user 2", schema: {} },
    ]);
  });

  it("[ai] rejects with a queued Error, so tests can script an API failure", async () => {
    const failure = new LlmError("API down");
    const client = new FakeLlmClient([failure]);
    await expect(client.completeJson("s", "u", SCHEMA)).rejects.toBe(failure);
  });

  it("[ai] rejects with LlmError when the queue runs out instead of returning undefined", async () => {
    const client = new FakeLlmClient([]);
    await expect(client.completeJson("s", "u", SCHEMA)).rejects.toBeInstanceOf(LlmError);
  });
});

describe("#43 LlmError", () => {
  it("[ai] is a named Error subclass that keeps its cause", () => {
    const cause = new Error("socket hang up");
    const error = new LlmError("Claude request failed", { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LlmError);
    expect(error.name).toBe("LlmError");
    expect(error.message).toBe("Claude request failed");
    expect(error.cause).toBe(cause);
  });
});

describe("#43 ClaudeClient", () => {
  const networkGuard = vi.fn(async () => {
    throw new Error("a test tried to reach the network");
  });

  beforeEach(() => {
    networkGuard.mockClear();
    vi.stubGlobal("fetch", networkGuard);
  });

  afterEach(() => {
    expect(networkGuard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("[ai] sends the system prompt, user prompt and model to the SDK", async () => {
    const { sdk, spy } = fakeSdk(async () => textMessage("{}"));
    await new ClaudeClient(sdk, { model: "test-model" }).completeJson("be strict", "the note", SCHEMA);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({
      model: "test-model",
      system: "be strict",
      messages: [{ role: "user", content: "the note" }],
    });
  });

  it("[ai] requests structured JSON output using the given schema", async () => {
    const { sdk, spy } = fakeSdk(async () => textMessage("{}"));
    await new ClaudeClient(sdk, { model: "test-model" }).completeJson("s", "u", SCHEMA);
    expect(spy.mock.calls[0][0]).toMatchObject({
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
  });

  it("[ai] sets a positive max_tokens, which the API requires", async () => {
    const { sdk, spy } = fakeSdk(async () => textMessage("{}"));
    await new ClaudeClient(sdk, { model: "test-model" }).completeJson("s", "u", SCHEMA);
    const params = spy.mock.calls[0][0] as { max_tokens: number };
    expect(params.max_tokens).toBeGreaterThan(0);
  });

  it("[ai] returns the parsed JSON from the text block", async () => {
    const client = clientReturning(textMessage('{"name":"Chris","followUp":null}'));
    await expect(client.completeJson("s", "u", SCHEMA)).resolves.toEqual({ name: "Chris", followUp: null });
  });

  it("[ai] reads the text block even when it isn't the first block", async () => {
    const client = clientReturning({
      content: [{ type: "thinking", thinking: "hmm" }, { type: "text", text: '{"name":"Dana"}' }],
      stop_reason: "end_turn",
    });
    await expect(client.completeJson("s", "u", SCHEMA)).resolves.toEqual({ name: "Dana" });
  });

  it.each([
    ["malformed JSON", textMessage("{not json")],
    ["JSON cut off midway", textMessage('{"name":"Chr')],
    ["an empty string", textMessage("")],
    ["no content blocks", { content: [], stop_reason: "end_turn" }],
    ["no text block", { content: [{ type: "thinking", thinking: "hmm" }], stop_reason: "end_turn" }],
  ] as [string, FakeMessage][])("[ai] throws LlmError on %s", async (_label, message) => {
    await expect(clientReturning(message).completeJson("s", "u", SCHEMA)).rejects.toBeInstanceOf(LlmError);
  });

  it.each(["refusal", "max_tokens"])(
    "[ai] throws LlmError on stop_reason %s, even when the text parses",
    async (stopReason) => {
      const client = clientReturning(textMessage('{"name":"Chris"}', stopReason));
      await expect(client.completeJson("s", "u", SCHEMA)).rejects.toBeInstanceOf(LlmError);
    },
  );

  it("[ai] wraps an API error in LlmError with a readable message and the original cause", async () => {
    const apiError = new Error("529 overloaded");
    const { sdk } = fakeSdk(async () => {
      throw apiError;
    });
    const error = await captureError(() => new ClaudeClient(sdk, { model: "m" }).completeJson("s", "u", SCHEMA));
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).message.length).toBeGreaterThan(0);
    expect((error as LlmError).cause).toBe(apiError);
  });

  it("[ai] wraps a non-Error rejection in LlmError too", async () => {
    const { sdk } = fakeSdk(async () => {
      throw "timeout";
    });
    const client = new ClaudeClient(sdk, { model: "m" });
    await expect(client.completeJson("s", "u", SCHEMA)).rejects.toBeInstanceOf(LlmError);
  });
});

describe("ClaudeClient timeouts", () => {
  it("[ai] turns an SDK timeout into an LlmError so the route answers with a 502", async () => {
    const timeout = Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    const client = new ClaudeClient(fakeSdk(async () => { throw timeout; }).sdk, { model: "test-model" });
    const error = await captureError(() => client.completeJson("s", "u", SCHEMA));
    expect(error).toBeInstanceOf(LlmError);
    expect((error as LlmError).cause).toBe(timeout);
  });
});
