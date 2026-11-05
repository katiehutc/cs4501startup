
import { describe, expect, it } from "vitest";
import type { Extraction } from "../contracts";
import type { Contact, Draft } from "../types";
import { validateExtraction, validateDraft } from "./validators";

const NOTE = "Talked with Alex, Analyst at Goldman Sachs FIG in New York.";

const extraction: Extraction = {
  contact: {
    name: "Alex",
    title: "Analyst",
    firmText: "Goldman Sachs",
    group: "FIG",
    city: "New York",
  },
  chatDate: "2026-11-04",
  referrals: [],
  followUp: null,
  evidence: {
    "contact.name": "Alex",
    "contact.title": "Analyst",
    "contact.firmText": "Goldman Sachs",
    "contact.group": "FIG",
    "contact.city": "New York",
  },
};

const contact: Contact = {
  id: "alex",
  name: "Alex",
  title: "Analyst",
  firmId: "gs",
  group: "FIG",
  city: "New York",
  stage: "chatted",
  notes: NOTE,
  timeline: [],
};

describe("#integration extraction and draft validation", () => {
  it("[ai] accepts grounded extraction", () => {
    expect(validateExtraction(extraction, NOTE, "2026-11-04")).toEqual([]);
  });

  it("[ai] rejects extracted details without evidence", () => {
    const invalid: Extraction = {
      ...extraction,
      contact: { ...extraction.contact, name: "Jordan" },
    };

    expect(
      validateExtraction(invalid, NOTE, "2026-11-04")
    ).toContainEqual(
      expect.objectContaining({ code: "ungrounded", field: "contact.name" })
    );
  });

  it("[ai] rejects invalid job titles", () => {
    const invalid: Extraction = {
      ...extraction,
      contact: { ...extraction.contact, title: "Wizard" },
    };

    expect(
      validateExtraction(invalid, NOTE, "2026-11-04")
    ).toContainEqual(
      expect.objectContaining({ code: "title_invalid", field: "contact.title" })
    );
  });

  it("[ai] accepts a grounded thank-you draft", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: ["Thanks for taking the time to chat."],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    expect(validateDraft(draft, NOTE, contact)).toEqual([]);
  });

  it("[ai] rejects drafts with unsupported claims", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: ["I enjoyed learning about your IPO work."],
      claims: [
        {
          text: "your IPO work",
          evidence: "discussed IPO transactions",
        },
      ],
      signoff: "Best,",
      removed: [],
    };

    expect(validateDraft(draft, NOTE, contact)).toContainEqual(
      expect.objectContaining({ code: "ungrounded" })
    );
  });

  it("[ai] rejects the wrong email recipient", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Jordan",
      paragraphs: ["Thanks for chatting."],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    expect(validateDraft(draft, NOTE, contact)).toContainEqual(
      expect.objectContaining({ code: "recipient_mismatch" })
    );
  });

it("[ai] rejects malformed referral data without crashing", () => {
  const invalid = {
    ...extraction,
    referrals: [{ name: 42, title: null, firmText: "Goldman Sachs" }],
  } as unknown as Extraction;

  expect(() =>
    validateExtraction(invalid, NOTE, "2026-11-04")
  ).not.toThrow();

  expect(
    validateExtraction(invalid, NOTE, "2026-11-04")
  ).toContainEqual(
    expect.objectContaining({ code: "schema" })
  );
});

it("[ai] rejects follow-ups without supporting evidence", () => {
  const invalid: Extraction = {
    ...extraction,
    followUp: {
      afterDays: 14,
      reason: "Follow up about an offer",
    },
  };

  expect(
    validateExtraction(invalid, NOTE, "2026-11-04")
  ).toContainEqual(
    expect.objectContaining({ code: "ungrounded", field: "followUp" })
  );
});

it("[ai] rejects invented draft details even without a listed claim", () => {
  const draft: Draft = {
    contactId: "alex",
    greetingName: "Alex",
    paragraphs: [
      "Thanks for chatting about your recent IPO at Goldman Sachs.",
    ],
    claims: [],
    signoff: "Best,",
    removed: [],
  };

  expect(validateDraft(draft, NOTE, contact)).toContainEqual(
    expect.objectContaining({ code: "ungrounded" })
  );
});

});

describe("#42 validateDraft", () => {
  it("[ai] rejects a draft mentioning the wrong firm", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: [
        "Thanks for sharing your experience at Morgan Stanley.",
      ],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    const errors = validateDraft(draft, NOTE, contact);

    expect(errors.some((e) => e.code === "recipient_mismatch")).toBe(true);
  });

  it("[ai] rejects placeholders in the signoff", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: ["Thanks for chatting!"],
      claims: [],
      signoff: "[Your name]",
      removed: [],
    };

    const errors = validateDraft(draft, NOTE, contact);

    expect(errors.some((e) => e.code === "placeholder")).toBe(true);
  });

  it("[ai] accepts a draft mentioning the correct firm", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: [
        "Thanks for telling me about your experience at Goldman Sachs.",
      ],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    const errors = validateDraft(draft, NOTE, contact);

    expect(errors).toEqual([]);
  });
});
