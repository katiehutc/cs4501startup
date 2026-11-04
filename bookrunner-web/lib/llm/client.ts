import type { LlmClient } from "../contracts";

const MAX_TOKENS = 4096;

export class LlmError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmError";
  }
}

export interface FakeLlmCall {
  system: string;
  user: string;
  schema: object;
}

export class FakeLlmClient implements LlmClient {
  readonly calls: FakeLlmCall[] = [];
  private readonly queue: unknown[];

  constructor(responses: unknown[]) {
    this.queue = [...responses];
  }

  async completeJson(system: string, user: string, schema: object): Promise<unknown> {
    this.calls.push({ system, user, schema });
    // An exhausted script is a broken test, and returning undefined would hide it.
    if (this.queue.length === 0) {
      throw new LlmError("FakeLlmClient has no responses left");
    }
    const next = this.queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  }
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user"; content: string }[];
  output_config: { format: { type: "json_schema"; schema: Record<string, unknown> } };
}

export interface ClaudeResponse {
  content: readonly { type: string; text?: string }[];
  stop_reason: string | null;
}

// Structural, so only the API route has to create the real SDK client.
export interface ClaudeSdk {
  messages: { create(params: ClaudeRequest): Promise<ClaudeResponse> };
}

export interface ClaudeClientOptions {
  model: string;
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function parseResponse(response: ClaudeResponse): unknown {
  // A refused or truncated reply can still parse, but isn't guaranteed to match the schema.
  if (response.stop_reason === "refusal") {
    throw new LlmError("Claude refused the request");
  }
  if (response.stop_reason === "max_tokens") {
    throw new LlmError("Claude's response was cut off");
  }
  const text = response.content.find((block) => block.type === "text")?.text;
  if (text === undefined) {
    throw new LlmError("Claude's response had no text");
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LlmError("Claude returned invalid JSON", { cause });
  }
}

export class ClaudeClient implements LlmClient {
  constructor(
    private readonly sdk: ClaudeSdk,
    private readonly options: ClaudeClientOptions,
  ) {}

  async completeJson(system: string, user: string, schema: object): Promise<unknown> {
    let response: ClaudeResponse;
    try {
      response = await this.sdk.messages.create({
        model: this.options.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
        output_config: {
          format: { type: "json_schema", schema: schema as Record<string, unknown> },
        },
      });
    } catch (cause) {
      throw new LlmError(`Claude request failed: ${describeCause(cause)}`, { cause });
    }
    return parseResponse(response);
  }
}
