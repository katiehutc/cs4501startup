
import type {
  Extraction,
  ExtractionValidator,
  ValidationError,
} from "../contracts";
import { resolveFirm } from "../firms/resolve";
import { GROUPS, TITLES } from "../firms/data";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isGrounded(evidence: string, note: string): boolean {
  return normalizeWhitespace(note).includes(
    normalizeWhitespace(evidence),
  );
}

export const validateExtraction: ExtractionValidator = (
  x,
  note,
  today,
): ValidationError[] => {
  const errors: ValidationError[] = [];

  function addError(
    code: ValidationError["code"],
    field: string,
    message: string,
  ) {
    errors.push({ code, field, message });
  }

  // Validate the overall extraction schema.
  if (!x || typeof x !== "object" || Array.isArray(x)) {
    addError("schema", "extraction", "Extraction must be an object.");
    return errors;
  }

  if (!x.contact || typeof x.contact !== "object") {
    addError("schema", "contact", "Contact must be an object.");
    return errors;
  }

  if (
    typeof x.contact.name !== "string" ||
    !x.contact.name.trim()
  ) {
    addError("schema", "contact.name", "Contact name is required.");
  }

  if (
    typeof x.contact.firmText !== "string" ||
    !x.contact.firmText.trim()
  ) {
    addError("schema", "contact.firmText", "Firm name is required.");
  }

  for (const field of ["title", "group", "city"] as const) {
    const value = x.contact[field];

    if (value !== null && typeof value !== "string") {
      addError(
        "schema",
        `contact.${field}`,
        `${field} must be a string or null.`,
      );
    }
  }

  if (
    typeof x.chatDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(x.chatDate)
  ) {
    addError(
      "schema",
      "chatDate",
      "Chat date must use YYYY-MM-DD.",
    );
  }

  if (!Array.isArray(x.referrals)) {
    addError("schema", "referrals", "Referrals must be an array.");
  }

  if (
    x.followUp !== null &&
    (
      !x.followUp ||
      typeof x.followUp !== "object" ||
      !Number.isInteger(x.followUp.afterDays) ||
      typeof x.followUp.reason !== "string"
    )
  ) {
    addError(
      "schema",
      "followUp",
      "Follow-up must contain afterDays and reason, or be null.",
    );
  }

  if (
    !x.evidence ||
    typeof x.evidence !== "object" ||
    Array.isArray(x.evidence)
  ) {
    addError("schema", "evidence", "Evidence must be an object.");
  }

  // Validate the firm, group, and title.
  if (
    typeof x.contact.firmText === "string" &&
    x.contact.firmText.trim()
  ) {
    const result = resolveFirm(x.contact.firmText);

    if (result.kind === "unknown") {
      addError(
        "firm_unknown",
        "contact.firmText",
        `Unknown firm: ${x.contact.firmText}`,
      );
    } else if (result.kind === "ambiguous") {
      addError(
        "firm_ambiguous",
        "contact.firmText",
        `Ambiguous firm: ${x.contact.firmText}`,
      );
    }
  }

  if (
    typeof x.contact.group === "string" &&
    !GROUPS.some(
      (group) =>
        normalizeWhitespace(group) ===
        normalizeWhitespace(x.contact.group!),
    )
  ) {
    addError(
      "group_unknown",
      "contact.group",
      `Unknown banking group: ${x.contact.group}`,
    );
  }

  if (
    typeof x.contact.title === "string" &&
    !TITLES.some(
      (title) =>
        normalizeWhitespace(title) ===
        normalizeWhitespace(x.contact.title!),
    )
  ) {
    addError(
      "title_invalid",
      "contact.title",
      `Invalid banking title: ${x.contact.title}`,
    );
  }

  // Verify that evidence appears in the original note.
  if (
    x.evidence &&
    typeof x.evidence === "object" &&
    !Array.isArray(x.evidence)
  ) {
    for (const [field, evidence] of Object.entries(x.evidence)) {
      if (
        typeof evidence !== "string" ||
        !evidence.trim()
      ) {
        addError(
          "schema",
          `evidence.${field}`,
          "Evidence must be a nonempty string.",
        );
      } else if (!isGrounded(evidence, note)) {
        addError(
          "ungrounded",
          field,
          `Evidence for ${field} was not found in the note.`,
        );
      }
    }
  }

  // A negative offset would schedule the follow-up in the past.
  if (
    x.followUp &&
    typeof x.followUp === "object" &&
    Number.isInteger(x.followUp.afterDays) &&
    x.followUp.afterDays < 0
  ) {
    addError(
      "date_past",
      "followUp.afterDays",
      "Follow-up cannot be scheduled in the past.",
    );
  }

  return errors;
};
