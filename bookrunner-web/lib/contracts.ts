import type { Firm, Contact, Draft } from "./types";

export interface ExtractedContact {
  name: string;
  title: string | null;
  firmText: string;
  group: string | null;
  city: string | null;
}

export interface Extraction {
  contact: ExtractedContact;
  chatDate: string;
  referrals: ExtractedContact[];
  followUp: { afterDays: number; reason: string } | null;
  evidence: Record<string, string>;
}

export type FirmMatch =
  | { kind: "match"; firm: Firm }
  | { kind: "ambiguous"; options: Firm[] }
  | { kind: "unknown"; text: string };

export interface ValidationError {
  code: "schema" | "firm_unknown" | "firm_ambiguous" | "group_unknown" | "title_invalid"
      | "ungrounded" | "recipient_mismatch" | "date_past" | "placeholder";
  field: string;
  message: string;
}

export interface LlmClient {
  completeJson(system: string, user: string, schema: object): Promise<unknown>;
}

export type Extractor = (note: string, today: string, previousErrors: ValidationError[]) => Promise<Extraction>;
export type DraftWriter = (contact: Contact, note: string, previousErrors: ValidationError[]) => Promise<Draft>;

export type FirmResolver = (text: string) => FirmMatch;
export type ExtractionValidator = (x: Extraction, note: string, today: string) => ValidationError[];
export type DraftValidator = (d: Draft, note: string, contact: Contact) => ValidationError[];

export type PipelineResult =
  | { kind: "ok"; extraction: Extraction; draft: Draft; attempts: number; trace: ValidationError[][] }
  | { kind: "question"; prompt: string; options: string[]; attempts: number; trace: ValidationError[][] }
  | { kind: "failed"; errors: ValidationError[]; attempts: number; trace: ValidationError[][] };

export const MAX_ATTEMPTS = 3;
