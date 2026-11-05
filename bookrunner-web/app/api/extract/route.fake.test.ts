// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

function post(note: string): Promise<Response> {
  return POST(new Request("http://localhost/api/extract", { method: "POST", body: JSON.stringify({ note }) }));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("#48 POST /api/extract with LLM_FAKE", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("[ai] returns a firm question for the tricky note, through the real validators, with no API key", async () => {
    vi.stubEnv("LLM_FAKE", "1");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await post("coffee w/ Sam, GS, TMT");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "question",
      options: expect.arrayContaining(["Goldman Sachs", "Guggenheim Securities"]),
    });
  });

  it("[ai] returns a validated extraction and draft once the student has answered", async () => {
    vi.stubEnv("LLM_FAKE", "1");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await post("coffee w/ Sam, GS, TMT\nFirm: Goldman Sachs");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "ok",
      attempts: 1,
      extraction: { contact: { name: "Sam", firmText: "Goldman Sachs" } },
      draft: { greetingName: "Sam" },
    });
  });

  it("[ai] doesn't use the fake unless LLM_FAKE is exactly 1", async () => {
    vi.stubEnv("LLM_FAKE", "0");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await post("coffee w/ Sam, GS, TMT");
    expect(response.status).toBe(500);
  });

  it("[ai] reports a missing API key without naming the variable to the browser", async () => {
    vi.stubEnv("LLM_FAKE", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await post("coffee w/ Sam, GS, TMT");
    expect(await response.text()).not.toContain("ANTHROPIC_API_KEY");
  });
});

describe("#48 API key handling", () => {
  it("[ai] reads ANTHROPIC_API_KEY only in the route", () => {
    const readers = ["app", "lib"]
      .flatMap((dir) => sourceFiles(join(process.cwd(), dir)))
      .filter((path) => readFileSync(path, "utf8").includes("ANTHROPIC_API_KEY"))
      .map((path) => path.replace(`${process.cwd()}/`, ""));
    expect(readers).toEqual(["app/api/extract/route.ts"]);
  });
});
