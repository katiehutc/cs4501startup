import { FakeLlmClient } from "../../../lib/llm/client";

const FIRM_ANSWER = /\nFirm: (.+)$/;

// Scripted for Playwright: the first request asks which firm, and the re-run with the answer goes through.
export function makeFakeLlm(note: string): FakeLlmClient {
  const firmText = note.match(FIRM_ANSWER)?.[1] ?? "GS";
  const extraction = {
    contact: { name: "Sam", title: null, firmText, group: "TMT", city: null },
    chatDate: "2026-10-21",
    referrals: [],
    followUp: null,
    evidence: [
      { field: "contact.name", quote: "Sam" },
      { field: "contact.firmText", quote: firmText },
      { field: "contact.group", quote: "TMT" },
    ],
  };
  const draft = {
    greetingName: "Sam",
    paragraphs: ["Thank you for making time for coffee. I hope we can stay in touch."],
    claims: [{ text: "coffee", evidence: "coffee" }],
    signoff: "Best,",
  };
  return new FakeLlmClient([extraction, draft]);
}
