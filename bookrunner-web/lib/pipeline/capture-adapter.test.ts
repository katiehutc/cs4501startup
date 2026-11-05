
import { describe, expect, it } from "vitest";
import type { PipelineResult } from "../contracts";
import { toCaptureResult } from "./capture-adapter";

describe("#integration capture pipeline adapter", () => {
  it("[ai] converts a clarification into a question", () => {
    const pipeline: PipelineResult = {
      kind: "question",
      prompt: 'Which firm did you mean by "GS"?',
      options: ["Goldman Sachs", "Guggenheim Securities"],
      attempts: 1,
      trace: [],
    };

    const result = toCaptureResult(pipeline);

    expect(result.questions).toEqual([
      {
        id: "firm",
        prompt: pipeline.prompt,
        options: [
          { label: "Goldman Sachs", value: "Goldman Sachs" },
          {
            label: "Guggenheim Securities",
            value: "Guggenheim Securities",
          },
        ],
      },
    ]);
    expect(result.proposals).toEqual([]);
  });

  it("[ai] preserves structured extraction and draft on success", () => {
    const extraction = {
      contact: {
        name: "Alex",
        title: "Analyst",
        firmText: "Goldman Sachs",
        group: "FIG",
        city: "New York",
      },
      chatDate: "2026-11-04",
      referrals: [],
      followUp: null,
      evidence: {},
    };

    const draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: ["Thanks for taking the time to chat."],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    const pipeline: PipelineResult = {
      kind: "ok",
      extraction,
      draft,
      attempts: 1,
      trace: [],
    };

    const result = toCaptureResult(pipeline);

    expect(result.questions).toEqual([]);
    expect(result.extraction).toEqual(extraction);
    expect(result.draft).toEqual(draft);
    expect(result.proposals.map((p) => p.kind)).toContain("log_chat");
    expect(result.proposals.map((p) => p.kind)).toContain("draft");
  });

  it("[ai] does not offer updates when validation fails", () => {
    const pipeline: PipelineResult = {
      kind: "failed",
      errors: [
        {
          code: "ungrounded",
          field: "contact.name",
          message: "Unsupported contact name",
        },
      ],
      attempts: 3,
      trace: [],
    };

    const result = toCaptureResult(pipeline);

    expect(result.questions).toEqual([]);
    expect(result.proposals).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
