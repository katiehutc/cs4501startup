import type { Extraction, FirmResolver, PipelineResult } from "../lib/contracts";

export interface ExpectedFields {
  name: string;
  title: string | null;
  firm: string;
  group: string | null;
  city: string | null;
  followUpDays: number | null;
  referrals: string[];
  firmOptions?: string[];
  flags?: string[];
}

export interface FieldScore {
  correct: number;
  total: number;
  misses: string[];
}

export interface NoteOutcome {
  kind: PipelineResult["kind"];
  attempts: number;
  score: FieldScore | null;
}

export interface EvalSummary {
  notes: number;
  fieldsCorrect: number;
  fieldsTotal: number;
  percentCorrect: number;
  passedOnAttempt: { 1: number; 2: number; 3: number };
  questions: number;
  failed: number;
}

function sameText(a: string | null, b: string | null): boolean {
  return (a?.trim().toLowerCase() ?? null) === (b?.trim().toLowerCase() ?? null);
}

function sameNames(a: string[], b: string[]): boolean {
  const sorted = (names: string[]): string =>
    JSON.stringify(names.map((name) => name.trim().toLowerCase()).sort());
  return sorted(a) === sorted(b);
}

// The labels hold what the app should conclude, so this scores the resolved firm rather than the note's text.
function firmIsCorrect(expected: ExpectedFields, firmText: string, resolve: FirmResolver): boolean {
  const match = resolve(firmText);
  if (expected.firm === "UNKNOWN") {
    return match.kind === "unknown";
  }
  if (expected.firm === "AMBIGUOUS") {
    return match.kind === "ambiguous" && sameNames(expected.firmOptions ?? [], match.options.map((firm) => firm.name));
  }
  return match.kind === "match" && sameText(expected.firm, match.firm.name);
}

export function scoreExtraction(expected: ExpectedFields, extraction: Extraction, resolve: FirmResolver): FieldScore {
  const { contact, followUp, referrals } = extraction;
  const checks: [string, boolean][] = [
    ["name", sameText(expected.name, contact.name)],
    ["title", sameText(expected.title, contact.title)],
    ["firm", firmIsCorrect(expected, contact.firmText, resolve)],
    ["group", sameText(expected.group, contact.group)],
    ["city", sameText(expected.city, contact.city)],
    ["followUpDays", expected.followUpDays === (followUp?.afterDays ?? null)],
    ["referrals", sameNames(expected.referrals, referrals.map((person) => person.name))],
  ];
  const misses = checks.filter(([, ok]) => !ok).map(([field]) => field);
  return { correct: checks.length - misses.length, total: checks.length, misses };
}

export function summarize(outcomes: NoteOutcome[]): EvalSummary {
  const summary: EvalSummary = {
    notes: outcomes.length,
    fieldsCorrect: 0,
    fieldsTotal: 0,
    percentCorrect: 0,
    passedOnAttempt: { 1: 0, 2: 0, 3: 0 },
    questions: 0,
    failed: 0,
  };
  for (const { kind, attempts, score } of outcomes) {
    summary.fieldsCorrect += score?.correct ?? 0;
    summary.fieldsTotal += score?.total ?? 0;
    if (kind === "question") summary.questions += 1;
    if (kind === "failed") summary.failed += 1;
    if (kind === "ok" && (attempts === 1 || attempts === 2 || attempts === 3)) {
      summary.passedOnAttempt[attempts] += 1;
    }
  }
  if (summary.fieldsTotal > 0) {
    summary.percentCorrect = Math.round((summary.fieldsCorrect / summary.fieldsTotal) * 1000) / 10;
  }
  return summary;
}

export function formatReport(summary: EvalSummary): string {
  return [
    `Notes: ${summary.notes}`,
    `Fields correct: ${summary.fieldsCorrect}/${summary.fieldsTotal} (${summary.percentCorrect}%)`,
    `Passed on attempt 1: ${summary.passedOnAttempt[1]}`,
    `Passed on attempt 2: ${summary.passedOnAttempt[2]}`,
    `Passed on attempt 3: ${summary.passedOnAttempt[3]}`,
    `Questions: ${summary.questions}`,
    `Failed: ${summary.failed}`,
  ].join("\n");
}
