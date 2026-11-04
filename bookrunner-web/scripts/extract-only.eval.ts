import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { it } from "vitest";
import { TODAY } from "../lib/dates";
import { resolveFirm } from "../lib/firms/resolve";
import { ClaudeClient } from "../lib/llm/client";
import { makeExtractor } from "../lib/llm/extract";
import { scoreExtraction } from "./eval-score";
import type { ExpectedFields, FieldScore } from "./eval-score";

const MODEL = "claude-sonnet-5-5";
const FIXTURES = join(process.cwd(), "fixtures", "notes");

interface Fixture {
  id: string;
  note: string;
  expected: ExpectedFields;
}

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture);
}

function missesByField(scores: FieldScore[]): string {
  const counts = new Map<string, number>();
  for (const field of scores.flatMap((score) => score.misses)) {
    counts.set(field, (counts.get(field) ?? 0) + 1);
  }
  return [...counts].map(([field, count]) => `${field}: ${count}`).join(", ") || "none";
}

// Extraction only, one attempt each: attempt counts need the validators, which aren't wired in yet.
it("scores one extraction per note on real Claude", async () => {
  const extract = makeExtractor(new ClaudeClient(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), { model: MODEL }));
  const scores: FieldScore[] = [];
  const fixtures = loadFixtures();

  for (const { id, note, expected } of fixtures) {
    try {
      const extraction = await extract(note, TODAY, []);
      const score = scoreExtraction(expected, extraction, resolveFirm);
      scores.push(score);
      const notVerbatim = Object.entries(extraction.evidence).filter(([, quote]) => !note.includes(quote));
      console.log(`\n${id}: ${score.correct}/${score.total}, misses: ${score.misses.join(", ") || "none"}`);
      if (score.misses.length > 0 || notVerbatim.length > 0) {
        console.log(`NOTE: ${note}`);
        console.log(`evidence not verbatim: ${notVerbatim.map(([field]) => field).join(", ") || "none"}`);
        console.log(JSON.stringify({ ...extraction, evidence: undefined }));
      }
    } catch (error) {
      console.log(`\n${id}: FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const correct = scores.reduce((sum, score) => sum + score.correct, 0);
  const total = scores.reduce((sum, score) => sum + score.total, 0);
  const percent = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  console.log(`\nExtraction only, first attempt, ${fixtures.length} notes, ${MODEL}`);
  console.log(`Fields correct: ${correct}/${total} (${percent}%)`);
  console.log(`Notes with every field correct: ${scores.filter((score) => score.misses.length === 0).length}`);
  console.log(`Misses by field: ${missesByField(scores)}`);
  console.log(`API failures: ${fixtures.length - scores.length}`);
});
