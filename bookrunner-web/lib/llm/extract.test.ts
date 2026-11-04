import { describe, expect, it } from "vitest";
import type { ValidationError } from "../contracts";
import { FakeLlmClient, LlmError } from "./client";
import { makeExtractor } from "./extract";

const NOTE = "talked w/ Chris, 1st yr analyst GS FIG NY, follow up in 3 wks, email his associate Dana";
const TODAY = "2026-10-21";

// Evidence is a list on the wire: the API requires additionalProperties: false, which rules out a free-form map.
const SAMPLE_RESPONSE = {
  contact: { name: "Chris", title: "Analyst", firmText: "GS", group: "FIG", city: "New York" },
  chatDate: TODAY,
  referrals: [{ name: "Dana", title: "Associate", firmText: "GS", group: null, city: null }],
  followUp: { afterDays: 21, reason: "follow up in 3 wks" },
  evidence: [
    { field: "contact.name", quote: "Chris" },
    { field: "contact.title", quote: "analyst" },
    { field: "contact.firmText", quote: "GS" },
    { field: "contact.group", quote: "FIG" },
    { field: "contact.city", quote: "NY" },
    { field: "followUp", quote: "follow up in 3 wks" },
    { field: "referrals[0].name", quote: "Dana" },
  ],
};

async function firstCall(previousErrors: ValidationError[] = [], today = TODAY, note = NOTE) {
  const client = new FakeLlmClient([SAMPLE_RESPONSE]);
  await makeExtractor(client)(note, today, previousErrors);
  return client.calls[0];
}

describe("#44 makeExtractor results", () => {
  it("[ai] returns Chris / Analyst / GS / FIG / New York from the sample note's response", async () => {
    const result = await makeExtractor(new FakeLlmClient([SAMPLE_RESPONSE]))(NOTE, TODAY, []);
    expect(result.contact).toEqual({ name: "Chris", title: "Analyst", firmText: "GS", group: "FIG", city: "New York" });
  });

  it("[ai] returns evidence as the contract's field-to-quote record", async () => {
    const result = await makeExtractor(new FakeLlmClient([SAMPLE_RESPONSE]))(NOTE, TODAY, []);
    expect(result.evidence).toEqual({
      "contact.name": "Chris",
      "contact.title": "analyst",
      "contact.firmText": "GS",
      "contact.group": "FIG",
      "contact.city": "NY",
      followUp: "follow up in 3 wks",
      "referrals[0].name": "Dana",
    });
  });

  it("[ai] returns afterDays: 21 for follow up in 3 wks", async () => {
    const result = await makeExtractor(new FakeLlmClient([SAMPLE_RESPONSE]))(NOTE, TODAY, []);
    expect(result.followUp).toEqual({ afterDays: 21, reason: "follow up in 3 wks" });
  });

  it("[ai] keeps an ambiguous firm exactly as written instead of picking one (tricky note 1)", async () => {
    const response = { ...SAMPLE_RESPONSE, contact: { name: "Sam", title: null, firmText: "GS", group: "TMT", city: null } };
    const result = await makeExtractor(new FakeLlmClient([response]))("coffee w/ Sam, GS, TMT", TODAY, []);
    expect(result.contact.firmText).toBe("GS");
  });

  it("[ai] keeps an unknown firm exactly as written (tricky note 2)", async () => {
    const response = { ...SAMPLE_RESPONSE, contact: { ...SAMPLE_RESPONSE.contact, firmText: "Acme Partners" } };
    const result = await makeExtractor(new FakeLlmClient([response]))("coffee at Acme Partners", TODAY, []);
    expect(result.contact.firmText).toBe("Acme Partners");
  });

  it("[ai] keeps the referral separate from the main contact (tricky note 3)", async () => {
    const response = {
      ...SAMPLE_RESPONSE,
      contact: { name: "Priya", title: "VP", firmText: "MS", group: "M&A", city: null },
      referrals: [{ name: "Jordan", title: "Analyst", firmText: "MS", group: null, city: null }],
    };
    const result = await makeExtractor(new FakeLlmClient([response]))("talked to Priya", TODAY, []);
    expect(result.contact.name).toBe("Priya");
    expect(result.referrals.map((person) => person.name)).toEqual(["Jordan"]);
  });

  it("[ai] keeps followUp null when no follow-up was mentioned (tricky note 4)", async () => {
    const result = await makeExtractor(new FakeLlmClient([{ ...SAMPLE_RESPONSE, followUp: null }]))("coffee w/ Chris", TODAY, []);
    expect(result.followUp).toBeNull();
  });

  it.each([
    ["an empty object", {}],
    ["null", null],
    ["evidence that isn't a list", { ...SAMPLE_RESPONSE, evidence: "Chris" }],
    ["a malformed evidence item", { ...SAMPLE_RESPONSE, evidence: [null, { field: 3 }] }],
  ])("[ai] doesn't crash on %s, so the validator can report a schema error", async (_label, response) => {
    await expect(makeExtractor(new FakeLlmClient([response]))(NOTE, TODAY, [])).resolves.toBeDefined();
  });

  it("[ai] lets an LlmError propagate", async () => {
    const failure = new LlmError("API down");
    await expect(makeExtractor(new FakeLlmClient([failure]))(NOTE, TODAY, [])).rejects.toBe(failure);
  });

  it("[ai] makes exactly one LLM call per extraction", async () => {
    const client = new FakeLlmClient([SAMPLE_RESPONSE, SAMPLE_RESPONSE]);
    await makeExtractor(client)(NOTE, TODAY, []);
    expect(client.calls).toHaveLength(1);
  });
});

describe("#44 makeExtractor prompt", () => {
  it("[ai] sends the note unchanged in the user prompt", async () => {
    const note = 'coffee w/ "Sam" @ GS, $5bn deal\n  2nd line';
    expect((await firstCall([], TODAY, note)).user).toContain(note);
  });

  it("[ai] puts the given date in the system prompt, not the system clock's", async () => {
    expect((await firstCall([], "2027-01-15")).system).toContain("2027-01-15");
  });

  it("[ai] includes the JSON schema in the system prompt", async () => {
    const { system, schema } = await firstCall();
    expect(system).toContain(JSON.stringify(schema));
  });

  it.each(["Analyst", "Associate", "VP", "Director", "MD"])("[ai] includes %s from the title ladder", async (title) => {
    expect((await firstCall()).system).toContain(title);
  });

  it("[ai] tells the model to quote evidence verbatim", async () => {
    expect((await firstCall()).system).toMatch(/verbatim/i);
  });

  it("[ai] tells the model never to guess a firm", async () => {
    expect((await firstCall()).system).toMatch(/never guess/i);
  });

  it("[ai] tells the model how weeks convert to days, with the 3 wks example", async () => {
    expect((await firstCall()).system).toMatch(/3 wks.*21/);
  });

  it("[ai] has no fix-up section on the first attempt", async () => {
    const { system, user } = await firstCall();
    expect(`${system}\n${user}`).not.toContain("Fix these problems");
  });

  it("[ai] lists every previous error's field and message under Fix these problems on a retry", async () => {
    const errors: ValidationError[] = [
      { code: "title_invalid", field: "contact.title", message: '"Boss" is not a valid title.' },
      { code: "ungrounded", field: "contact.city", message: '"Boston" is not in the note.' },
    ];
    const { system, user } = await firstCall(errors);
    const prompt = `${system}\n${user}`;
    expect(prompt).toContain("Fix these problems");
    for (const problem of errors) {
      expect(prompt).toContain(problem.field);
      expect(prompt).toContain(problem.message);
    }
  });
});
