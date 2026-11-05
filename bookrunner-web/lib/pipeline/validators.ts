
import type {
  Extraction,
  ExtractionValidator,
  DraftValidator,
  ValidationError,
} from "../contracts";
import type { Draft } from "../types";
import { GROUPS, TITLES } from "../firms/data";

function error(
  code: ValidationError["code"],
  field: string,
  message: string,
): ValidationError {
  return { code, field, message };
}

function supported(
  value: string,
  quote: string | undefined,
  note: string,
): boolean {
  if (!quote || !value.trim()) {
    return false;
  }

  const normalizedNote = note.toLowerCase();
  const normalizedQuote = quote.toLowerCase();
  const normalizedValue = value.toLowerCase();

  // The evidence must appear in the original note.
  if (!normalizedNote.includes(normalizedQuote)) {
    return false;
  }

  // The extracted value must match its evidence.
  if (normalizedQuote.includes(normalizedValue)) {
    return true;
  }

  // Allow known shorthand expansions.
  const aliases: Record<string, string[]> = {
    "new york": ["ny", "nyc"],
    "financial institutions group": ["fig"],
    "healthcare": ["hc"],
    "restructuring": ["rx"],
    "consumer & retail": ["cnr"],
  };

  return (aliases[normalizedValue] ?? []).some(
    (alias) => normalizedQuote === alias,
  );
}

export const validateExtraction: ExtractionValidator = (
  extraction,
  note,
  today,
) => {
  const errors: ValidationError[] = [];

  if (
    !extraction ||
    typeof extraction !== "object" ||
    !extraction.contact ||
    typeof extraction.contact.name !== "string" ||
    !Array.isArray(extraction.referrals) ||
    typeof extraction.chatDate !== "string" ||
    !extraction.evidence ||
    typeof extraction.evidence !== "object"
  ) {
    return [error("schema", "extraction", "Invalid extraction structure")];
  }

  const checkPerson = (
    person: Extraction["contact"],
    prefix: string,
  ) => {
    if (!person || typeof person !== "object") {
      errors.push(error("schema", prefix, "Invalid contact"));
      return;
    }

    if (!person.name || typeof person.name !== "string") {
      errors.push(error("schema", `${prefix}.name`, "Missing name"));
    }

    if (person.title !== null && !TITLES.includes(person.title)) {
      errors.push(
        error("title_invalid", `${prefix}.title`, "Invalid title"),
      );
    }

    if (person.group !== null && !GROUPS.includes(person.group)) {
      errors.push(
        error("group_unknown", `${prefix}.group`, "Unknown group"),
      );
    }

    for (const field of ["name", "title", "firmText", "group", "city"] as const) {
      const value = person[field];
      if (typeof value === "string" && value.trim()) {
        const path = `${prefix}.${field}`;
        if (!supported(value, extraction.evidence[path], note)) {
          errors.push(
            error("ungrounded", path, `No supporting evidence for ${path}`),
          );
        }
      }
    }
  };

  checkPerson(extraction.contact, "contact");

  extraction.referrals.forEach((person, index) => {
    checkPerson(person, `referrals[${index}]`);
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(extraction.chatDate)) {
    errors.push(error("schema", "chatDate", "Invalid date format"));
  } else if (extraction.chatDate > today) {
    errors.push(error("date_past", "chatDate", "Chat date is in the future"));
  }

  if (extraction.followUp !== null) {
    const followUp = extraction.followUp;

    if (
        !followUp ||
        typeof followUp.afterDays !== "number" ||
        !Number.isInteger(followUp.afterDays) ||
        followUp.afterDays < 0 ||
        typeof followUp.reason !== "string"
    ) {
        errors.push(
        error("schema", "followUp", "Invalid follow-up structure")
        );
    } else {
        const quote = extraction.evidence["followUp"];

        if (
        !quote ||
        !note.toLowerCase().includes(quote.toLowerCase())
        ) {
        errors.push(
            error(
            "ungrounded",
            "followUp",
            "Follow-up has no supporting evidence in the note"
            )
        );
        }
    }
    }

  return errors;
};

export const validateDraft: DraftValidator = (
  draft,
  note,
  contact,
) => {
  const errors: ValidationError[] = [];

  if (
    !draft ||
    typeof draft !== "object" ||
    !Array.isArray(draft.paragraphs) ||
    !Array.isArray(draft.claims) ||
    typeof draft.greetingName !== "string"
  ) {
    return [error("schema", "draft", "Invalid draft structure")];
  }

  const firstName = contact.name.split(" ")[0];

  if (draft.greetingName !== firstName) {
    errors.push(
      error(
        "recipient_mismatch",
        "greetingName",
        `Expected ${firstName}, got ${draft.greetingName}`,
      ),
    );
  }

  const body = draft.paragraphs.join("\n");

  // Conservative check for unsupported specific deal references.
    // This is an additional guardrail, not a complete factuality check.
    const dealTerms = /\b(IPO|merger|acquisition|transaction|deal)\b/gi;

    const noteTerms = new Set(
    (note.match(dealTerms) ?? []).map((term) => term.toLowerCase())
    );

    const draftTerms = new Set(
    (body.match(dealTerms) ?? []).map((term) => term.toLowerCase())
    );

    for (const term of draftTerms) {
    if (!noteTerms.has(term)) {
        errors.push(
        error(
            "ungrounded",
            "paragraphs",
            `Draft mentions "${term}" without support in the note`
        )
        );
    }
}

  if (/\[[^\]]+\]/.test(body)) {
    errors.push(
      error("placeholder", "paragraphs", "Draft contains placeholders"),
    );
  }

  for (const claim of draft.claims) {
    if (
      !note.toLowerCase().includes(claim.evidence.toLowerCase()) ||
      !body.includes(claim.text)
    ) {
      errors.push(
        error("ungrounded", "claims", `Unsupported claim: ${claim.text}`),
      );
    }
  }

  return errors;
};
