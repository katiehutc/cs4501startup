import { describe, expect, it } from "vitest";
import type { ValidationError } from "../contracts";
import type { Contact } from "../types";
import { FakeLlmClient, LlmError } from "./client";
import { makeDraftWriter } from "./draft";

const NOTE = "talked w/ Chris Lee, 1st yr analyst GS FIG NY, said the group is growing. he mentioned the Acme deal";

const CONTACT: Contact = {
  id: "c1",
  name: "Chris Lee",
  title: "Analyst",
  firmId: "gs",
  group: "FIG",
  city: "New York",
  stage: "chatted",
  notes: NOTE,
  timeline: [],
};

const RESPONSE = {
  greetingName: "Chris",
  paragraphs: ["Thanks for the time. It was great to hear the group is growing."],
  claims: [{ text: "the group is growing", evidence: "the group is growing" }],
  signoff: "Best,",
};

const firmName = (firmId: string): string => (firmId === "gs" ? "Goldman Sachs" : firmId);

function writerReturning(response: unknown) {
  return makeDraftWriter(new FakeLlmClient([response]), firmName);
}

async function promptFor(previousErrors: ValidationError[] = [], contact = CONTACT, note = NOTE) {
  const client = new FakeLlmClient([RESPONSE]);
  await makeDraftWriter(client, firmName)(contact, note, previousErrors);
  const { system, user, schema } = client.calls[0];
  return { system, user, schema, all: `${system}\n${user}` };
}

describe("#45 makeDraftWriter results", () => {
  it("[ai] returns the draft with its claims and evidence", async () => {
    const draft = await writerReturning(RESPONSE)(CONTACT, NOTE, []);
    expect(draft.greetingName).toBe("Chris");
    expect(draft.paragraphs).toEqual(RESPONSE.paragraphs);
    expect(draft.claims).toEqual(RESPONSE.claims);
    expect(draft.signoff).toBe("Best,");
  });

  it("[ai] sets contactId from the contact, even if the model returns another", async () => {
    const draft = await writerReturning({ ...RESPONSE, contactId: "wrong" })(CONTACT, NOTE, []);
    expect(draft.contactId).toBe("c1");
  });

  it("[ai] starts with no removed claims, even if the model returns some", async () => {
    const draft = await writerReturning({ ...RESPONSE, removed: ["something"] })(CONTACT, NOTE, []);
    expect(draft.removed).toEqual([]);
  });

  it("[ai] allows a draft with no claims, for a note with no usable facts", async () => {
    const draft = await writerReturning({ ...RESPONSE, claims: [] })(CONTACT, "coffee w/ Chris", []);
    expect(draft.claims).toEqual([]);
  });

  it.each([
    ["an empty object", {}],
    ["null", null],
    ["a string", "not a draft"],
    ["paragraphs that aren't a list", { ...RESPONSE, paragraphs: "Thanks" }],
    ["paragraphs that aren't strings", { ...RESPONSE, paragraphs: [1] }],
    ["claims that aren't a list", { ...RESPONSE, claims: null }],
    ["a claim with no evidence", { ...RESPONSE, claims: [{ text: "growing" }] }],
    ["a missing greeting name", { ...RESPONSE, greetingName: undefined }],
    ["a missing signoff", { ...RESPONSE, signoff: undefined }],
  ])("[ai] throws LlmError on %s rather than crashing the draft validator", async (_label, response) => {
    await expect(writerReturning(response)(CONTACT, NOTE, [])).rejects.toBeInstanceOf(LlmError);
  });

  it("[ai] lets an API LlmError propagate unchanged", async () => {
    const failure = new LlmError("API down");
    await expect(writerReturning(failure)(CONTACT, NOTE, [])).rejects.toBe(failure);
  });

  it("[ai] makes exactly one LLM call per draft", async () => {
    const client = new FakeLlmClient([RESPONSE, RESPONSE]);
    await makeDraftWriter(client, firmName)(CONTACT, NOTE, []);
    expect(client.calls).toHaveLength(1);
  });
});

describe("#45 makeDraftWriter prompt", () => {
  it("[ai] sends the note unchanged", async () => {
    const note = 'coffee w/ "Chris" @ GS\n  $5bn deal';
    expect((await promptFor([], CONTACT, note)).user).toContain(note);
  });

  it("[ai] names the contact in full", async () => {
    expect((await promptFor()).all).toContain("Chris Lee");
  });

  it("[ai] gives the model the firm's name and keeps its internal id out of the prompt", async () => {
    const contact = { ...CONTACT, firmId: "firm-123" };
    const lookUp = (id: string): string => (id === "firm-123" ? "Goldman Sachs" : "wrong firm");
    const client = new FakeLlmClient([RESPONSE]);

    await makeDraftWriter(client, lookUp)(contact, NOTE, []);
    const { system, user } = client.calls[0];
    const prompt = `${system}\n${user}`;

    expect(prompt).toContain("Goldman Sachs");
    expect(prompt).not.toContain("wrong firm");
    expect(prompt).not.toContain("firm-123");
  });

  it("[ai] asks for the contact's first name as the greeting name", async () => {
    expect((await promptFor()).all).toMatch(/greetingName[^\n]*"?Chris"?/);
  });

  it("[ai] leaves out a title, group or city the contact doesn't have", async () => {
    const bare = { ...CONTACT, title: "", group: "", city: "" };
    const { user } = await promptFor([], bare);
    expect(user).not.toMatch(/Title:|Group:|City:/);
  });

  it("[ai] tells the model to list every factual phrase as a claim", async () => {
    expect((await promptFor()).system).toMatch(/every factual phrase/i);
  });

  it("[ai] tells the model that claim evidence is quoted verbatim from the note", async () => {
    expect((await promptFor()).system).toMatch(/verbatim/i);
  });

  it("[ai] forbids claiming the student discussed or worked on a deal only mentioned in passing (tricky note 5)", async () => {
    expect((await promptFor()).system).toMatch(/deal[^\n]*passing/i);
  });

  it("[ai] forbids saying a topic was discussed or enjoyed unless the note says so", async () => {
    expect((await promptFor()).system).toMatch(/discussed[^\n]*only if the note says so/i);
  });

  it("[ai] tells the model not to recite the contact's own job details back to them", async () => {
    expect((await promptFor()).system).toMatch(/recite/i);
  });

  it("[ai] asks for each claim's text to be a short phrase, not a whole sentence", async () => {
    expect((await promptFor()).system).toMatch(/short phrase/i);
  });

  it("[ai] forbids placeholders, which the validator rejects", async () => {
    expect((await promptFor()).system).toMatch(/placeholder/i);
  });

  it("[ai] tells the model the app adds the greeting and sender name itself", async () => {
    expect((await promptFor()).system).toMatch(/app adds/i);
  });

  it("[ai] has no fix-up section on the first attempt", async () => {
    expect((await promptFor()).all).not.toContain("Fix these problems");
  });

  it("[ai] lists every previous error's field and message under Fix these problems on a retry", async () => {
    const errors: ValidationError[] = [
      { code: "ungrounded", field: "claims[0]", message: '"worked on the Acme deal" is not in the note.' },
      { code: "placeholder", field: "paragraphs", message: 'Remove "[Your name]".' },
    ];
    const { all } = await promptFor(errors);
    expect(all).toContain("Fix these problems");
    for (const problem of errors) {
      expect(all).toContain(problem.field);
      expect(all).toContain(problem.message);
    }
  });
});

describe("#45 makeDraftWriter schema", () => {
  interface ObjectSchema {
    properties: Record<string, { items?: ObjectSchema }>;
    required: string[];
    additionalProperties: unknown;
  }

  it("[ai] asks only for the fields the model should write", async () => {
    const schema = (await promptFor()).schema as ObjectSchema;
    expect(Object.keys(schema.properties).sort()).toEqual(["claims", "greetingName", "paragraphs", "signoff"]);
  });

  it("[ai] closes the draft and claim objects and requires all their properties, as the API demands", async () => {
    const schema = (await promptFor()).schema as ObjectSchema;
    const claim = schema.properties.claims.items as ObjectSchema;
    for (const node of [schema, claim]) {
      expect(node.additionalProperties).toBe(false);
      expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
    }
    expect(Object.keys(claim.properties).sort()).toEqual(["evidence", "text"]);
  });
});
