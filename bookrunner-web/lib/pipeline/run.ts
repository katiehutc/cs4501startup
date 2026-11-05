import { MAX_ATTEMPTS } from "../contracts";
import type {
  DraftValidator,
  DraftWriter,
  ExtractedContact,
  Extraction,
  ExtractionValidator,
  Extractor,
  FirmResolver,
  PipelineResult,
  ValidationError,
} from "../contracts";
import type { Contact, Firm } from "../types";

// The real id is assigned when the student saves the contact.
const UNSAVED_CONTACT_ID = "unsaved";
const FIRM_ANSWER = /\nFirm: (.+)$/;

export interface PipelineDeps {
  extract: Extractor;
  draft: DraftWriter;
  validateExtraction: ExtractionValidator;
  validateDraft: DraftValidator;
  resolveFirm: FirmResolver;
}

type ExtractionCheck = { firm: Firm } | { errors: ValidationError[] };

interface FirmQuestion {
  prompt: string;
  options: string[];
}

function firmError(code: "firm_ambiguous" | "firm_unknown", firmText: string): ValidationError {
  const problem = code === "firm_ambiguous" ? "could mean more than one firm" : "is not a firm we know";
  return { code, field: "contact.firmText", message: `"${firmText}" ${problem}.` };
}

// The resolver runs even after the validator passes, so a draft can never go out for a guessed firm.
function checkExtraction(extraction: Extraction, note: string, today: string, deps: PipelineDeps): ExtractionCheck {
  const errors = deps.validateExtraction(extraction, note, today);
  if (errors.length > 0) {
    return { errors };
  }
  const firmText = extraction.contact.firmText;
  const match = deps.resolveFirm(firmText);
  if (match.kind === "match") {
    return { firm: match.firm };
  }
  return { errors: [firmError(match.kind === "ambiguous" ? "firm_ambiguous" : "firm_unknown", firmText)] };
}

function findFirmQuestion(extraction: Extraction, resolveFirm: FirmResolver): FirmQuestion | null {
  for (const person of [extraction.contact, ...extraction.referrals]) {
    const match = resolveFirm(person.firmText);
    if (match.kind === "ambiguous") {
      return {
        prompt: `Which firm did you mean by "${person.firmText}"?`,
        options: match.options.map((firm) => firm.name),
      };
    }
  }
  return null;
}

// In code, not the prompt: the model sometimes repeats the shorthand, which would ask the student the same question again.
function applyFirmAnswer(extraction: Extraction, note: string, resolveFirm: FirmResolver): Extraction {
  const answer = note.match(FIRM_ANSWER)?.[1]?.trim();
  if (!answer || !extraction?.contact || !Array.isArray(extraction.referrals)) {
    return extraction;
  }
  const answered = resolveFirm(answer);
  if (answered.kind !== "match") {
    return extraction;
  }
  const evidence = { ...extraction.evidence };
  const settle = (person: ExtractedContact, field: string): ExtractedContact => {
    const match = typeof person?.firmText === "string" ? resolveFirm(person.firmText) : null;
    if (match?.kind !== "ambiguous" || !match.options.some((firm) => firm.id === answered.firm.id)) {
      return person;
    }
    evidence[`${field}.firmText`] = answer;
    return { ...person, firmText: answer };
  };
  return {
    ...extraction,
    contact: settle(extraction.contact, "contact"),
    referrals: extraction.referrals.map((person, index) => settle(person, `referrals[${index}]`)),
    evidence,
  };
}

function toContact(extraction: Extraction, firm: Firm, note: string): Contact {
  const { name, title, group, city } = extraction.contact;
  return {
    id: UNSAVED_CONTACT_ID,
    name,
    title: title ?? "",
    firmId: firm.id,
    group: group ?? "",
    city: city ?? "",
    stage: "chatted",
    notes: note,
    timeline: [],
  };
}

export async function runPipeline(note: string, today: string, deps: PipelineDeps): Promise<PipelineResult> {
  if (note.trim() === "") {
    const errors: ValidationError[] = [{ code: "schema", field: "note", message: "The note is empty." }];
    return { kind: "failed", errors, attempts: 0, trace: [] };
  }

  const trace: ValidationError[][] = [];
  let previousErrors: ValidationError[] = [];
  let validated: { extraction: Extraction; contact: Contact } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (validated === null) {
      const extraction = applyFirmAnswer(await deps.extract(note, today, previousErrors), note, deps.resolveFirm);
      const check = checkExtraction(extraction, note, today, deps);
      if ("errors" in check) {
        trace.push(check.errors);
        previousErrors = check.errors;
        const question = check.errors.some((e) => e.code === "firm_ambiguous")
          ? findFirmQuestion(extraction, deps.resolveFirm)
          : null;
        if (question !== null) {
          return { kind: "question", ...question, attempts: attempt, trace };
        }
        continue;
      }
      validated = { extraction, contact: toContact(extraction, check.firm, note) };
      // Extraction errors describe a record that's now fixed, so the draft writer starts clean.
      previousErrors = [];
    }

    const draft = await deps.draft(validated.contact, note, previousErrors);
    const errors = deps.validateDraft(draft, note, validated.contact);
    if (errors.length === 0) {
      return { kind: "ok", extraction: validated.extraction, draft, attempts: attempt, trace };
    }
    trace.push(errors);
    previousErrors = errors;
  }

  return { kind: "failed", errors: previousErrors, attempts: MAX_ATTEMPTS, trace };
}
