
import type { PipelineResult, ValidationError } from "../contracts";
import type { Draft, ExtractionResult, Proposal } from "../types";
import type { Extraction } from "../contracts";

export type CapturePipelineResult = ExtractionResult & {
  extraction?: Extraction;
  draft?: Draft;
  attempts?: number;
  trace?: ValidationError[][];
  errors?: ValidationError[];
};

export function toCaptureResult(
  pipeline: PipelineResult
): CapturePipelineResult {
  const base = {
    attempts: pipeline.attempts,
    trace: pipeline.trace,
  };

  if (pipeline.kind === "question") {
    return {
      ...base,
      questions: [
        {
          id: "firm",
          prompt: pipeline.prompt,
          options: pipeline.options.map((name) => ({
            label: name,
            value: name,
          })),
        },
      ],
      proposals: [],
    };
  }

  if (pipeline.kind === "failed") {
    return {
      ...base,
      questions: [],
      proposals: [],
      errors: pipeline.errors,
    };
  }

  const proposals: Proposal[] = [
    {
      id: "contact",
      kind: "new_contact",
      title: `Save ${pipeline.extraction.contact.name}`,
    },
    {
      id: "chat",
      kind: "log_chat",
      title: `Log chat with ${pipeline.extraction.contact.name}`,
      detail: pipeline.extraction.chatDate,
    },
  ];

  pipeline.extraction.referrals.forEach((referral, index) => {
    proposals.push({
      id: `referral-${index}`,
      kind: "new_lead",
      title: `Add referral: ${referral.name}`,
      detail: referral.firmText,
    });
  });

  if (pipeline.extraction.followUp) {
    proposals.push({
      id: "follow-up",
      kind: "follow_up",
      title: `Follow up with ${pipeline.extraction.contact.name}`,
      detail: pipeline.extraction.followUp.reason,
    });
  }

  proposals.push({
    id: "draft",
    kind: "draft",
    title: `Draft thank-you to ${pipeline.extraction.contact.name}`,
  });

  return {
    ...base,
    questions: [],
    proposals,
    extraction: pipeline.extraction,
    draft: pipeline.draft,
  };
}
