
import type {
  ExtractedContact,
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


  function validateContact(
    contact: unknown,
    prefix: string,
  ): void {
    if (
      !contact ||
      typeof contact !== "object" ||
      Array.isArray(contact)
    ) {
      addError("schema", prefix, "Contact must be an object.");
      return;
    }

    const c = contact as Partial<ExtractedContact>;

    if (typeof c.name !== "string" || !c.name.trim()) {
      addError(
        "schema",
        `${prefix}.name`,
        "Contact name is required.",
      );
    }

    if (
      typeof c.firmText !== "string" ||
      !c.firmText.trim()
    ) {
      addError(
        "schema",
        `${prefix}.firmText`,
        "Firm name is required.",
      );
    } else {
      const result = resolveFirm(c.firmText);

      if (result.kind === "unknown") {
        addError(
          "firm_unknown",
          `${prefix}.firmText`,
          `Unknown firm: ${c.firmText}`,
        );
      } else if (result.kind === "ambiguous") {
        addError(
          "firm_ambiguous",
          `${prefix}.firmText`,
          `Ambiguous firm: ${c.firmText}`,
        );
      }
    }

    for (const field of ["title", "group", "city"] as const) {
      const value = c[field];

      if (value !== null && typeof value !== "string") {
        addError(
          "schema",
          `${prefix}.${field}`,
          `${field} must be a string or null.`,
        );
      }
    }

    if (
      typeof c.title === "string" &&
      !TITLES.some(
        (title) =>
          normalizeWhitespace(title) ===
          normalizeWhitespace(c.title!),
      )
    ) {
      addError(
        "title_invalid",
        `${prefix}.title`,
        `Invalid banking title: ${c.title}`,
      );
    }

    if (
      typeof c.group === "string" &&
      !GROUPS.some(
        (group) =>
          normalizeWhitespace(group) ===
          normalizeWhitespace(c.group!),
      )
    ) {
      addError(
        "group_unknown",
        `${prefix}.group`,
        `Unknown banking group: ${c.group}`,
      );
    }
  }


  // Validate the overall extraction schema.
  if (!x || typeof x !== "object" || Array.isArray(x)) {
    addError("schema", "extraction", "Extraction must be an object.");
    return errors;
  }

  validateContact(x.contact, "contact");

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
  } else {
    x.referrals.forEach((referral, index) => {
        validateContact(referral, `referrals[${index}]`);
      });
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
