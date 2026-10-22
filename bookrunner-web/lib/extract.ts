import type { ExtractionResult } from "./types";

export const SAMPLE_NOTE =
  "talked w/ Chris, 1st yr analyst GS FIG NY. good convo about the group. said follow up in 3 wks and email his associate Dana";

// Front-end demo only. In the real app this calls the backend, which asks the
// LLM for structured JSON, validates it, and retries on failures before
// returning. Here we return the result that pipeline would produce for the
// sample note so the review screen can be built and tested.
export async function extractFromNotes(text: string): Promise<ExtractionResult> {
  await new Promise((r) => setTimeout(r, 600));

  if (!/\bchris\b/i.test(text)) {
    throw new Error(
      "The demo can only read the sample note. Once the backend is connected, any notes will work.",
    );
  }

  return {
    questions: [
      {
        id: "firm",
        prompt: 'Is "GS" Goldman Sachs or Guggenheim Securities?',
        options: [
          { label: "Goldman Sachs", value: "gs" },
          { label: "Guggenheim", value: "gugg" },
        ],
      },
    ],
    proposals: [
      { id: "p-contact", kind: "new_contact", title: "Chris · Analyst (1st yr)", detail: "Financial Institutions Group · New York" },
      { id: "p-chat", kind: "log_chat", title: "Coffee chat with Chris · Oct 21" },
      { id: "p-lead", kind: "new_lead", title: "Dana · Associate · referred by Chris", detail: "Last name unknown, add it later" },
      { id: "p-follow", kind: "follow_up", title: "Check in with Chris · Wed, Nov 11", detail: 'From "follow up in 3 wks" · no calendar conflict' },
      { id: "p-draft", kind: "draft", title: "Thank-you email to Chris", detail: "Due today" },
    ],
  };
}
