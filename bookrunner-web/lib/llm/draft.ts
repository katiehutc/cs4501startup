import type { DraftWriter, LlmClient, ValidationError } from "../contracts";
import type { Claim, Contact, Draft } from "../types";
import { LlmError } from "./client";

type DraftResponse = Pick<Draft, "greetingName" | "paragraphs" | "claims" | "signoff">;

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    greetingName: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, evidence: { type: "string" } },
        required: ["text", "evidence"],
        additionalProperties: false,
      },
    },
    signoff: { type: "string" },
  },
  required: ["greetingName", "paragraphs", "claims", "signoff"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You write short, warm thank-you emails from a college student to an investment banker after a coffee chat.

Rules:
- Use only facts from the student's note. Never invent details, and keep it to 2 short paragraphs.
- List every factual phrase in the email as a claim. text is the phrase exactly as it appears in the email. evidence quotes the supporting words from the note verbatim, with no changes to spelling or case.
- A deal mentioned in passing is background only: never say the student discussed it, worked on it or knows details of it.
- The app adds the "Hi name," line and the student's name, so paragraphs holds only the body and signoff is a closing such as "Best,".
- Never use a placeholder or anything in square brackets. If a detail is missing, leave it out.
- Refer to the firm only by the name given.`;

function userPrompt(contact: Contact, firm: string, note: string, previousErrors: ValidationError[]): string {
  const details = [
    `Contact: ${contact.name}`,
    `greetingName must be: ${contact.name.split(" ")[0]}`,
    `Firm: ${firm}`,
    contact.title && `Title: ${contact.title}`,
    contact.group && `Group: ${contact.group}`,
    contact.city && `City: ${contact.city}`,
  ].filter(Boolean);
  const base = `${details.join("\n")}\n\nNote:\n${note}`;
  if (previousErrors.length === 0) {
    return base;
  }
  const problems = previousErrors.map((error) => `- ${error.field}: ${error.message}`).join("\n");
  return `${base}\n\nFix these problems from your previous attempt:\n${problems}`;
}

function isClaim(value: unknown): value is Claim {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const claim = value as Record<string, unknown>;
  return typeof claim.text === "string" && typeof claim.evidence === "string";
}

function isDraftResponse(value: unknown): value is DraftResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.greetingName === "string" &&
    typeof draft.signoff === "string" &&
    Array.isArray(draft.paragraphs) &&
    draft.paragraphs.every((paragraph) => typeof paragraph === "string") &&
    Array.isArray(draft.claims) &&
    draft.claims.every(isClaim)
  );
}

export function makeDraftWriter(client: LlmClient, firmName: (firmId: string) => string): DraftWriter {
  return async (contact, note, previousErrors) => {
    const user = userPrompt(contact, firmName(contact.firmId), note, previousErrors);
    const response = await client.completeJson(SYSTEM_PROMPT, user, DRAFT_SCHEMA);
    if (!isDraftResponse(response)) {
      throw new LlmError("Claude returned a draft in the wrong shape");
    }
    const { greetingName, paragraphs, claims, signoff } = response;
    return { contactId: contact.id, greetingName, paragraphs, claims, signoff, removed: [] };
  };
}
