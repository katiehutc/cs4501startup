import { vi } from "vitest";
import type {
  DraftValidator,
  DraftWriter,
  Extraction,
  ExtractionValidator,
  Extractor,
  FirmMatch,
  FirmResolver,
  ValidationError,
} from "../contracts";
import type { Draft, Firm } from "../types";

export const NOTE = "talked w/ Chris, 1st yr analyst GS FIG NY, follow up in 3 wks, email his associate Dana";
export const TODAY = "2026-10-21";

export const GOLDMAN: Firm = { id: "gs", name: "Goldman Sachs", tier: "Bulge bracket", aliases: ["GS"] };
export const GUGGENHEIM: Firm = { id: "guggenheim", name: "Guggenheim Securities", tier: "Middle market", aliases: ["GS"] };
export const MORGAN: Firm = { id: "ms", name: "Morgan Stanley", tier: "Bulge bracket", aliases: ["MS"] };

export function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    contact: { name: "Chris", title: "Analyst", firmText: "Goldman", group: "FIG", city: "New York" },
    chatDate: TODAY,
    referrals: [],
    followUp: { afterDays: 21, reason: "follow up in 3 wks" },
    evidence: { name: "Chris" },
    ...overrides,
  };
}

export function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    contactId: "c1",
    greetingName: "Chris",
    paragraphs: ["Thanks for the chat about FIG."],
    claims: [{ text: "FIG", evidence: "FIG" }],
    signoff: "Best",
    removed: [],
    ...overrides,
  };
}

export function error(code: ValidationError["code"], field = "contact.firmText"): ValidationError {
  return { code, field, message: `${code} on ${field}` };
}

// Unlisted firm text is unknown, so a test can't pass by the pipeline guessing a firm.
export function resolverFor(known: Record<string, FirmMatch>): FirmResolver {
  return (text) => known[text] ?? { kind: "unknown", text };
}

export function makeDeps() {
  return {
    extract: vi.fn<Extractor>(async () => extraction()),
    draft: vi.fn<DraftWriter>(async () => draft()),
    validateExtraction: vi.fn<ExtractionValidator>(() => []),
    validateDraft: vi.fn<DraftValidator>(() => []),
    resolveFirm: vi.fn<FirmResolver>(resolverFor({ Goldman: { kind: "match", firm: GOLDMAN } })),
  };
}
