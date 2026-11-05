import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { it } from "vitest";
import { ClaudeClient } from "../lib/llm/client";
import { makeDraftWriter } from "../lib/llm/draft";
import { CLAUDE_MODEL } from "../lib/llm/model";
import type { Contact } from "../lib/types";
import type { ExpectedFields } from "./eval-score";

const FIXTURES = join(process.cwd(), "fixtures", "notes");

interface Fixture {
  note: string;
  expected: ExpectedFields;
}

function firmNameFor(expected: ExpectedFields): string | null {
  if (expected.firm === "UNKNOWN") return null;
  // A spot check only: the real pipeline asks the student instead of picking the first option.
  return expected.firm === "AMBIGUOUS" ? (expected.firmOptions?.[0] ?? null) : expected.firm;
}

// Starts from the labeled fields, so a bad draft can't be blamed on a bad extraction.
it("prints one draft per note from real Claude for reading", async () => {
  const client = new ClaudeClient(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }), { model: CLAUDE_MODEL });
  const write = makeDraftWriter(client, (firmId) => firmId);

  for (const file of readdirSync(FIXTURES).filter((name) => name.endsWith(".json")).sort()) {
    const { note, expected } = JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture;
    const firmName = firmNameFor(expected);
    if (firmName === null) {
      console.log(`\n${file}: skipped, no firm to write to`);
      continue;
    }
    const contact: Contact = {
      id: "unsaved",
      name: expected.name,
      title: expected.title ?? "",
      firmId: firmName,
      group: expected.group ?? "",
      city: expected.city ?? "",
      stage: "chatted",
      notes: note,
      timeline: [],
    };
    try {
      const draft = await write(contact, note, []);
      const notVerbatim = draft.claims.filter((claim) => !note.includes(claim.evidence)).map((claim) => claim.text);
      console.log(`\n${file}\nNOTE: ${note}\nHi ${draft.greetingName},\n${draft.paragraphs.join("\n")}\n${draft.signoff}`);
      console.log(`claims: ${JSON.stringify(draft.claims)}`);
      console.log(`evidence not verbatim: ${notVerbatim.join("; ") || "none"}`);
    } catch (error) {
      console.log(`\n${file}: FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
});
