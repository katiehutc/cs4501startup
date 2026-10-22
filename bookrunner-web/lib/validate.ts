import type { Contact, Draft, Firm } from "./types";

export interface Check {
  id: string;
  ok: boolean;
  label: string;
}

const PLACEHOLDER = /\[[^\]]+\]/g;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

export function draftText(draft: Draft, senderName: string): string {
  const signoff = `${draft.signoff}\n${senderName.trim() || "[Your name]"}`;
  return [`Hi ${draft.greetingName},`, ...draft.paragraphs, signoff].join("\n\n");
}

// Deterministic checks that run on every draft before the student sees it.
// A failing check is what gets sent back to the LLM on a retry.
export function validateDraft(draft: Draft, contact: Contact, firms: Firm[], senderName: string): Check[] {
  const text = draftText(draft, senderName);
  const notes = normalize(contact.notes);

  const unsupported = draft.claims.filter((c) => !notes.includes(normalize(c.evidence)));
  const grounding: Check = {
    id: "grounding",
    ok: unsupported.length === 0,
    label:
      unsupported.length === 0
        ? "Highlighted details all appear in your notes"
        : `${unsupported.length} detail(s) not found in your notes`,
  };

  const firstName = contact.name.split(" ")[0];
  const firm = firms.find((f) => f.id === contact.firmId);
  const otherFirm = firms.find(
    (f) =>
      f.id !== contact.firmId &&
      f.name !== firm?.name &&
      [f.name, ...f.aliases.filter((a) => !firm?.aliases.includes(a))].some((n) => containsWord(text, n)),
  );
  const recipient: Check = {
    id: "recipient",
    ok: draft.greetingName === firstName && !otherFirm,
    label: otherFirm
      ? `Mentions ${otherFirm.name}, but ${firstName} is at ${firm?.name}`
      : draft.greetingName !== firstName
        ? `Greeting says ${draft.greetingName}, but the contact is ${firstName}`
        : "Name and firm match the contact record",
  };

  const placeholders = text.match(PLACEHOLDER) ?? [];
  const filled: Check = {
    id: "placeholders",
    ok: placeholders.length === 0,
    label:
      placeholders.length === 0
        ? "No placeholders left"
        : `${placeholders.length} placeholder left: ${placeholders.join(", ")}`,
  };

  return [grounding, recipient, filled];
}
