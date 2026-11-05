
import { describe, expect, it } from "vitest";
import type { Extraction } from "../contracts";
import { validateExtraction } from "./extraction";

const TODAY = "2026-11-04";

const NOTE =
  "Coffee chat with Jake at Goldman Sachs on November 3. " +
  "Jake is an Analyst in TMT. " +
  "He offered to introduce me to Priya. Follow up in 7 days.";

function validExtraction(): Extraction {
  return {
    contact: {
      name: "Jake",
      title: "Analyst",
      firmText: "Goldman Sachs",
      group: "TMT",
      city: null,
    },
    chatDate: "2026-11-03",
    referrals: [],
    followUp: {
      afterDays: 7,
      reason: "Follow up in 7 days",
    },
    evidence: {
      "contact.name": "Jake",
      "contact.title": "Analyst",
      "contact.firmText": "Goldman Sachs",
      "contact.group": "TMT",
      "followUp.reason": "Follow up in 7 days",
    },
  };
}

describe("#41 validateExtraction", () => {
  it("[ai] accepts a valid extraction", () => {
    expect(validateExtraction(validExtraction(), NOTE, TODAY)).toEqual([]);
  });

  it("[ai] returns schema errors for missing required fields", () => {
    const extraction = {
      ...validExtraction(),
      contact: {
        name: "Jake",
        firmText: "Goldman Sachs",
      },
    };

    const errors = validateExtraction(
      extraction as unknown as Extraction,
      NOTE,
      TODAY,
    );

    expect(errors.some((error) => error.code === "schema")).toBe(true);
  });

  it("[ai] returns schema errors instead of throwing on null input", () => {
    expect(() =>
      validateExtraction(
        null as unknown as Extraction,
        NOTE,
        TODAY,
      ),
    ).not.toThrow();

    const errors = validateExtraction(
      null as unknown as Extraction,
      NOTE,
      TODAY,
    );

    expect(errors.some((error) => error.code === "schema")).toBe(true);
  });

  it("[ai] rejects unknown firms", () => {
    const extraction = validExtraction();
    extraction.contact.firmText = "Fake Investment Bank";
    extraction.evidence["contact.firmText"] = "Fake Investment Bank";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "firm_unknown")).toBe(true);
  });

  it("[ai] flags ambiguous firm abbreviations", () => {
    const extraction = validExtraction();
    extraction.contact.firmText = "GS";
    extraction.evidence["contact.firmText"] = "GS";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "firm_ambiguous")).toBe(true);
  });

  it("[ai] rejects unknown banking groups", () => {
    const extraction = validExtraction();
    extraction.contact.group = "Underwater Basket Weaving";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "group_unknown")).toBe(true);
  });

  it("[ai] rejects invalid titles", () => {
    const extraction = validExtraction();
    extraction.contact.title = "Chief Coffee Officer";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "title_invalid")).toBe(true);
  });

  it("[ai] rejects evidence not found in the original note", () => {
    const extraction = validExtraction();
    extraction.evidence["contact.name"] = "Someone not mentioned";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "ungrounded")).toBe(true);
  });

  it("[ai] matches evidence regardless of capitalization", () => {
    const extraction = validExtraction();
    extraction.evidence["contact.name"] = "JAKE";

    expect(validateExtraction(extraction, NOTE, TODAY)).toEqual([]);
  });

  it("[ai] matches evidence despite extra whitespace", () => {
    const extraction = validExtraction();
    extraction.evidence["contact.firmText"] = "Goldman   Sachs";

    expect(validateExtraction(extraction, NOTE, TODAY)).toEqual([]);
  });

  it("[ai] rejects follow-up dates in the past", () => {
    const extraction = validExtraction();
    extraction.followUp = {
      afterDays: -2,
      reason: "Follow up in 7 days",
    };

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors.some((error) => error.code === "date_past")).toBe(true);
  });

  it("[ai] accepts a follow-up scheduled for today", () => {
    const extraction = validExtraction();
    extraction.followUp = {
      afterDays: 0,
      reason: "Follow up in 7 days",
    };

    expect(
      validateExtraction(extraction, NOTE, TODAY).some(
        (error) => error.code === "date_past",
      ),
    ).toBe(false);
  });

  it("[ai] accepts null optional fields", () => {
    const extraction = validExtraction();
    extraction.contact.title = null;
    extraction.contact.group = null;
    extraction.contact.city = null;
    extraction.followUp = null;

    expect(validateExtraction(extraction, NOTE, TODAY)).toEqual([]);
  });

  it("[ai] returns structured errors with field and message", () => {
    const extraction = validExtraction();
    extraction.contact.title = "Invalid Title";

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors).toContainEqual({
      code: "title_invalid",
      field: "contact.title",
      message: expect.any(String),
    });
  });

  it("[ai] rejects a referral missing required fields", () => {
    const extraction = validExtraction();

    extraction.referrals = [
      { name: "Priya" } as Extraction["referrals"][number],
    ];

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors).toContainEqual({
      code: "schema",
      field: "referrals[0].firmText",
      message: expect.any(String),
    });
  });

  it("[ai] rejects null referral entries without throwing", () => {
    const extraction = validExtraction();

    extraction.referrals = [
      null as unknown as Extraction["referrals"][number],
    ];

    expect(() =>
      validateExtraction(extraction, NOTE, TODAY),
    ).not.toThrow();

    expect(
      validateExtraction(extraction, NOTE, TODAY).some(
        (error) => error.code === "schema",
      ),
    ).toBe(true);
  });

  it("[ai] validates referral firm names", () => {
    const extraction = validExtraction();

    extraction.referrals = [
      {
        name: "Priya",
        title: "VP",
        firmText: "Imaginary Investment Bank",
        group: null,
        city: null,
      },
    ];

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors).toContainEqual({
      code: "firm_unknown",
      field: "referrals[0].firmText",
      message: expect.any(String),
    });
  });

  it("[ai] validates referral titles and groups", () => {
    const extraction = validExtraction();

    extraction.referrals = [
      {
        name: "Priya",
        title: "Chief Coffee Officer",
        firmText: "Goldman Sachs",
        group: "Underwater Basket Weaving",
        city: null,
      },
    ];

    const errors = validateExtraction(extraction, NOTE, TODAY);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "title_invalid",
          field: "referrals[0].title",
        }),
        expect.objectContaining({
          code: "group_unknown",
          field: "referrals[0].group",
        }),
      ]),
    );
  });

  it("[ai] rejects malformed evidence without throwing", () => {
    const extraction = validExtraction();

    extraction.evidence = {
      "contact.name": null,
    } as unknown as Extraction["evidence"];

    expect(() =>
      validateExtraction(extraction, NOTE, TODAY),
    ).not.toThrow();

    expect(
      validateExtraction(extraction, NOTE, TODAY).some(
        (error) => error.code === "schema",
      ),
    ).toBe(true);
  });

  it("[ai] rejects malformed follow-up values", () => {
    const extraction = validExtraction();

    extraction.followUp = {
      afterDays: "seven",
      reason: "Follow up in 7 days",
    } as unknown as Extraction["followUp"];

    expect(
      validateExtraction(extraction, NOTE, TODAY).some(
        (error) => error.code === "schema",
      ),
    ).toBe(true);
  });

  it("[ai] rejects a malformed contact without throwing", () => {
    const extraction = validExtraction();

    extraction.contact = null as unknown as Extraction["contact"];

    expect(() =>
      validateExtraction(extraction, NOTE, TODAY),
    ).not.toThrow();

    expect(
      validateExtraction(extraction, NOTE, TODAY).some(
        (error) => error.code === "schema",
      ),
    ).toBe(true);
  });
});
