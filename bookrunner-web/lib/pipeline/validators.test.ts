
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
});
