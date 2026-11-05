import { describe, expect, it } from "vitest";
import type { Extraction, FirmResolver } from "../lib/contracts";
import type { Firm } from "../lib/types";
import { formatReport, scoreExtraction, summarize } from "./eval-score";
import type { ExpectedFields } from "./eval-score";

const GOLDMAN: Firm = { id: "gs", name: "Goldman Sachs", tier: "Bulge bracket", aliases: ["Goldman", "GS"] };
const GUGGENHEIM: Firm = { id: "gugg", name: "Guggenheim Securities", tier: "Middle market", aliases: ["GS"] };
const MORGAN: Firm = { id: "ms", name: "Morgan Stanley", tier: "Bulge bracket", aliases: ["MS"] };

const resolve: FirmResolver = (text) => {
  const key = text.trim().toLowerCase();
  if (key === "gs") return { kind: "ambiguous", options: [GOLDMAN, GUGGENHEIM] };
  if (key === "goldman") return { kind: "match", firm: GOLDMAN };
  if (key === "ms") return { kind: "match", firm: MORGAN };
  return { kind: "unknown", text };
};

const EXPECTED: ExpectedFields = {
  name: "Chris",
  title: "Analyst",
  firm: "Goldman Sachs",
  group: "FIG",
  city: "New York",
  followUpDays: 21,
  referrals: ["Dana"],
};

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    contact: { name: "Chris", title: "Analyst", firmText: "Goldman", group: "FIG", city: "New York" },
    chatDate: "2026-10-21",
    referrals: [{ name: "Dana", title: "Associate", firmText: "Goldman", group: null, city: null }],
    followUp: { afterDays: 21, reason: "follow up in 3 wks" },
    evidence: {},
    ...overrides,
  };
}

describe("#52 scoreExtraction", () => {
  it("[ai] scores all 7 fields correct on a perfect extraction", () => {
    expect(scoreExtraction(EXPECTED, extraction(), resolve)).toEqual({ correct: 7, total: 7, misses: [] });
  });

  it.each([
    ["name", { contact: { name: "Dana", title: "Analyst", firmText: "Goldman", group: "FIG", city: "New York" } }],
    ["title", { contact: { name: "Chris", title: "VP", firmText: "Goldman", group: "FIG", city: "New York" } }],
    ["firm", { contact: { name: "Chris", title: "Analyst", firmText: "MS", group: "FIG", city: "New York" } }],
    ["group", { contact: { name: "Chris", title: "Analyst", firmText: "Goldman", group: "TMT", city: "New York" } }],
    ["city", { contact: { name: "Chris", title: "Analyst", firmText: "Goldman", group: "FIG", city: "Boston" } }],
    ["followUpDays", { followUp: { afterDays: 14, reason: "r" } }],
    ["referrals", { referrals: [] }],
  ] as [string, Partial<Extraction>][])("[ai] misses only %s when only it is wrong", (field, overrides) => {
    expect(scoreExtraction(EXPECTED, extraction(overrides), resolve)).toEqual({ correct: 6, total: 7, misses: [field] });
  });

  it("[ai] ignores case and surrounding spaces in text fields", () => {
    const contact = { name: " chris ", title: "ANALYST", firmText: "goldman", group: "fig", city: "new york" };
    expect(scoreExtraction(EXPECTED, extraction({ contact }), resolve).correct).toBe(7);
  });

  it("[ai] counts expected nulls as correct when the extraction is null too", () => {
    const expected = { ...EXPECTED, title: null, group: null, city: null, followUpDays: null, referrals: [] };
    const contact = { name: "Chris", title: null, firmText: "Goldman", group: null, city: null };
    expect(scoreExtraction(expected, extraction({ contact, followUp: null, referrals: [] }), resolve).correct).toBe(7);
  });

  it("[ai] counts a value where null was expected as wrong, so invented details lose points", () => {
    const score = scoreExtraction({ ...EXPECTED, city: null }, extraction(), resolve);
    expect(score.misses).toEqual(["city"]);
  });

  it("[ai] counts a follow-up where none was mentioned as wrong (tricky note 4)", () => {
    expect(scoreExtraction({ ...EXPECTED, followUpDays: null }, extraction(), resolve).misses).toEqual(["followUpDays"]);
  });

  it("[ai] compares referral names in any order", () => {
    const person = (name: string) => ({ name, title: null, firmText: "GS", group: null, city: null });
    const referrals = [person("Jordan"), person("Dana")];
    expect(scoreExtraction({ ...EXPECTED, referrals: ["dana", "jordan"] }, extraction({ referrals }), resolve).misses).toEqual([]);
  });

  it("[ai] counts a missing or extra referral as wrong", () => {
    const person = (name: string) => ({ name, title: null, firmText: "GS", group: null, city: null });
    expect(scoreExtraction(EXPECTED, extraction({ referrals: [person("Dana"), person("Jordan")] }), resolve).misses).toEqual(["referrals"]);
  });
});

describe("#52 scoreExtraction firm labels", () => {
  const withFirm = (firmText: string): Extraction =>
    extraction({ contact: { name: "Chris", title: "Analyst", firmText, group: "FIG", city: "New York" } });
  const AMBIGUOUS: ExpectedFields = { ...EXPECTED, firm: "AMBIGUOUS", firmOptions: ["Goldman Sachs", "Guggenheim Securities"] };
  const UNKNOWN: ExpectedFields = { ...EXPECTED, firm: "UNKNOWN" };

  it("[ai] compares a named firm to the resolved firm, not the text in the note", () => {
    expect(scoreExtraction({ ...EXPECTED, firm: "Morgan Stanley" }, withFirm("MS"), resolve).misses).toEqual([]);
  });

  it("[ai] counts a named firm as wrong when the text resolves as ambiguous", () => {
    expect(scoreExtraction(EXPECTED, withFirm("GS"), resolve).misses).toEqual(["firm"]);
  });

  it("[ai] counts a named firm as wrong when our data doesn't know the text", () => {
    expect(scoreExtraction({ ...EXPECTED, firm: "Perella Weinberg Partners" }, withFirm("PWP"), resolve).misses).toEqual(["firm"]);
  });

  it("[ai] counts AMBIGUOUS as correct when the resolver returns the same options in any order", () => {
    const reversed = { ...AMBIGUOUS, firmOptions: ["Guggenheim Securities", "Goldman Sachs"] };
    expect(scoreExtraction(reversed, withFirm("GS"), resolve).misses).toEqual([]);
  });

  it("[ai] counts AMBIGUOUS as wrong when the model expanded the firm into a match", () => {
    expect(scoreExtraction(AMBIGUOUS, withFirm("Goldman"), resolve).misses).toEqual(["firm"]);
  });

  it("[ai] counts AMBIGUOUS as wrong when the options differ", () => {
    expect(scoreExtraction({ ...AMBIGUOUS, firmOptions: ["Goldman Sachs"] }, withFirm("GS"), resolve).misses).toEqual(["firm"]);
  });

  it("[ai] counts UNKNOWN as correct when the resolver doesn't know the firm", () => {
    expect(scoreExtraction(UNKNOWN, withFirm("Arsenal Capital"), resolve).misses).toEqual([]);
  });

  it("[ai] counts UNKNOWN as wrong when the model invented a known bank", () => {
    expect(scoreExtraction(UNKNOWN, withFirm("Goldman"), resolve).misses).toEqual(["firm"]);
  });
});

describe("#52 scoreExtraction follow-up tolerance", () => {
  const withDays = (afterDays: number): Extraction => extraction({ followUp: { afterDays, reason: "r" } });
  const expected: ExpectedFields = { ...EXPECTED, followUpDays: 75 };

  it("[ai] needs an exact match when a note has no tolerance", () => {
    expect(scoreExtraction(expected, withDays(74), resolve).misses).toEqual(["followUpDays"]);
  });

  it.each([72, 75, 78])("[ai] accepts %i days with a tolerance of 3 around 75", (days) => {
    expect(scoreExtraction(expected, withDays(days), resolve, 3).misses).toEqual([]);
  });

  it.each([71, 79])("[ai] rejects %i days, just outside a tolerance of 3 around 75", (days) => {
    expect(scoreExtraction(expected, withDays(days), resolve, 3).misses).toEqual(["followUpDays"]);
  });

  it("[ai] still counts no follow-up as wrong when one was expected", () => {
    expect(scoreExtraction(expected, extraction({ followUp: null }), resolve, 3).misses).toEqual(["followUpDays"]);
  });

  it("[ai] still counts a follow-up as wrong when none was expected", () => {
    expect(scoreExtraction({ ...EXPECTED, followUpDays: null }, withDays(1), resolve, 3).misses).toEqual(["followUpDays"]);
  });
});

describe("#52 summarize", () => {
  const perfect = { correct: 7, total: 7, misses: [] };
  const half = { correct: 3, total: 6, misses: ["name", "title", "city"] };

  it("[ai] counts notes that passed on each attempt", () => {
    const summary = summarize([
      { kind: "ok", attempts: 1, score: perfect },
      { kind: "ok", attempts: 1, score: perfect },
      { kind: "ok", attempts: 2, score: perfect },
      { kind: "ok", attempts: 3, score: perfect },
    ]);
    expect(summary.passedOnAttempt).toEqual({ 1: 2, 2: 1, 3: 1 });
  });

  it("[ai] counts questions and failures apart from passes", () => {
    const summary = summarize([
      { kind: "question", attempts: 1, score: perfect },
      { kind: "failed", attempts: 3, score: half },
    ]);
    expect(summary).toMatchObject({ notes: 2, questions: 1, failed: 1, passedOnAttempt: { 1: 0, 2: 0, 3: 0 } });
  });

  it("[ai] works out the percent of fields correct across all notes", () => {
    const summary = summarize([
      { kind: "ok", attempts: 1, score: perfect },
      { kind: "failed", attempts: 3, score: half },
    ]);
    expect(summary).toMatchObject({ fieldsCorrect: 10, fieldsTotal: 13, percentCorrect: 76.9 });
  });

  it("[ai] leaves a note with no extraction out of the field score but keeps it in the note count", () => {
    const summary = summarize([{ kind: "failed", attempts: 0, score: null }]);
    expect(summary).toMatchObject({ notes: 1, failed: 1, fieldsTotal: 0, percentCorrect: 0 });
  });

  it("[ai] handles no notes without dividing by zero", () => {
    expect(summarize([])).toMatchObject({ notes: 0, percentCorrect: 0 });
  });
});

describe("#52 formatReport", () => {
  it("[ai] prints the percent correct, attempt counts, questions and failures", () => {
    const report = formatReport({
      notes: 20,
      fieldsCorrect: 133,
      fieldsTotal: 140,
      percentCorrect: 95,
      passedOnAttempt: { 1: 14, 2: 2, 3: 1 },
      questions: 2,
      failed: 1,
    });
    expect(report).toContain("95%");
    expect(report).toContain("133/140");
    expect(report).toMatch(/attempt 1: 14/i);
    expect(report).toMatch(/attempt 2: 2/i);
    expect(report).toMatch(/attempt 3: 1/i);
    expect(report).toMatch(/questions?: 2/i);
    expect(report).toMatch(/failed: 1/i);
  });
});
