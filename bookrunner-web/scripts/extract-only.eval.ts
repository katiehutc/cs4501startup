import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { it } from "vitest";
import { TODAY } from "../lib/dates";
import { ClaudeClient } from "../lib/llm/client";
import { makeExtractor } from "../lib/llm/extract";
import { scoreExtraction } from "./eval-score";
import type { ExpectedFields, FieldScore } from "./eval-score";

const MODEL = "claude-sonnet-5-5";
const FIXTURES = join(process.cwd(), "fixtures", "notes");

interface Fixture {
  note: string;
  expected: ExpectedFields;
}

function loadFixtures(): [string, Fixture][] {
  return readdirSync(FIXTURES)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file): [string, Fixture] => [file, JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture]);
}

// Extraction only, one attempt each: attempt counts need the validators, which aren't wired in yet.
it("scores one extraction per note on real Claude", async () => {
  const extract = makeExtractor(new ClaudeClient(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), { model: MODEL }));
  const scores: FieldScore[] = [];
  let apiFailures = 0;

  for (const [file, { note, expected }] of loadFixtures()) {
    try {
      const extraction = await extract(note, TODAY, []);
      const score = scoreExtraction(expected, extraction);
      scores.push(score);
      const notVerbatim = Object.entries(extraction.evidence).filter(([, quote]) => !note.includes(quote));
      console.log(`\n${file}: ${score.correct}/${score.total}, misses: ${score.misses.join(", ") || "none"}`);
      console.log(`evidence not verbatim: ${notVerbatim.map(([field]) => field).join(", ") || "none"}`);
      console.log(JSON.stringify(extraction));
    } catch (error) {
      apiFailures += 1;
      console.log(`\n${file}: FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const correct = scores.reduce((sum, score) => sum + score.correct, 0);
  const total = scores.reduce((sum, score) => sum + score.total, 0);
  console.log(`\nExtraction only, first attempt: ${correct}/${total} fields correct, ${apiFailures} API failures`);
});
