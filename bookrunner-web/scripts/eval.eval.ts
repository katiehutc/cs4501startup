import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { it, vi } from "vitest";
import type { Extraction, PipelineResult } from "../lib/contracts";
import { TODAY } from "../lib/dates";
import { resolveFirm } from "../lib/firms/resolve";
import { ClaudeClient } from "../lib/llm/client";
import { CLAUDE_MODEL } from "../lib/llm/model";
import { runPipeline } from "../lib/pipeline/run";
import { makePipelineDeps } from "../lib/pipeline/server";
import { formatReport, scoreExtraction, summarize } from "./eval-score";
import type { ExpectedFields, NoteOutcome } from "./eval-score";

vi.mock("server-only", () => ({}));

const FIXTURES = join(process.cwd(), "fixtures", "notes");

interface Fixture {
  id: string;
  note: string;
  expected: ExpectedFields;
  followUpToleranceDays?: number;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture);
}

function missesByField(outcomes: NoteOutcome[]): string {
  const counts = new Map<string, number>();
  for (const field of outcomes.flatMap((outcome) => outcome.score?.misses ?? [])) {
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  return [...counts].map(([field, count]) => `${field}: ${count}`).join(", ") || "none";
}

// Runs the same pipeline as the app, and scores the last extraction so a note that ends in a question still counts.
it("runs the full pipeline on every labeled note with real Claude", async () => {
  const client = new ClaudeClient(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), { model: CLAUDE_MODEL });
  const deps = makePipelineDeps(client);
  const outcomes: NoteOutcome[] = [];
  let apiFailures = 0;

  for (const { id, note, expected, followUpToleranceDays } of loadFixtures()) {
    let last: Extraction | null = null;
    const extract: typeof deps.extract = async (...args) => {
      last = await deps.extract(...args);
      return last;
    };
    let result: PipelineResult | null = null;
    try {
      result = await runPipeline(note, TODAY, { ...deps, extract });
    } catch (error) {
      apiFailures += 1;
      console.log(`\n${id}: API FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
    const score = last === null ? null : scoreExtraction(expected, last, resolveFirm, followUpToleranceDays);
    outcomes.push({ kind: result?.kind ?? "failed", attempts: result?.attempts ?? 0, score });
    console.log(`\n${id}: ${result?.kind ?? "api failure"}, attempts ${result?.attempts ?? 0}, misses: ${score?.misses.join(", ") || "none"}`);
    if (result?.kind === "failed") {
      console.log(`errors: ${result.errors.map((error) => `${error.code} ${error.field}: ${error.message}`).join(" | ")}`);
    }
    if (score !== null && score.misses.length > 0) {
      console.log(`NOTE: ${note}`);
      console.log(JSON.stringify(last));
    }
  }

  console.log(`\nFull pipeline, ${outcomes.length} notes, ${CLAUDE_MODEL}, one run`);
  console.log(formatReport(summarize(outcomes)));
  console.log(`Misses by field: ${missesByField(outcomes)}`);
  console.log(`API failures: ${apiFailures}`);
});
