import { describe, expect, it } from "vitest";
import type { Extraction } from "../contracts";
import { validateExtraction } from "./validators";

const TODAY = "2026-10-21";

function lauren(city: string, quote: string): Extraction {
  return {
    contact: { name: "Lauren", title: null, firmText: "JPM", group: null, city },
    chatDate: TODAY,
    referrals: [],
    followUp: null,
    evidence: { "contact.name": "Lauren", "contact.firmText": "JPM", "contact.city": quote },
  };
}

function priyaAndJordan(referralFirm: string): Extraction {
  return {
    contact: { name: "Priya", title: null, firmText: "MS", group: null, city: null },
    chatDate: TODAY,
    referrals: [{ name: "Jordan", title: null, firmText: referralFirm, group: null, city: null }],
    followUp: null,
    evidence: { "contact.name": "Priya", "contact.firmText": "MS", "referrals[0].name": "Jordan" },
  };
}

describe("#41 validateExtraction evidence", () => {
  it.each([
    ["San Francisco", "SF", "Lauren at JPM in SF"],
    ["Los Angeles", "LA", "Lauren at JPM in LA"],
    ["Chicago", "CHI", "Lauren at JPM in CHI"],
    ["Boston", "BOS", "Lauren at JPM in BOS"],
  ])("[ai] accepts %s when the note says %s", (city, quote, note) => {
    expect(validateExtraction(lauren(city, quote), note, TODAY)).toEqual([]);
  });

  it("[ai] still rejects a city whose quote is another city's shorthand", () => {
    expect(validateExtraction(lauren("San Francisco", "NY"), "Lauren at JPM in NY", TODAY)).toContainEqual(
      expect.objectContaining({ code: "ungrounded", field: "contact.city" }),
    );
  });

  it("[ai] accepts a colleague who shares the contact's firm without separate evidence (tricky note 3)", () => {
    const note = "coffee w/ Priya, MS. her analyst Jordan runs the list";
    expect(validateExtraction(priyaAndJordan("MS"), note, TODAY)).toEqual([]);
  });

  it("[ai] still needs evidence for a referral at a different firm", () => {
    const note = "coffee w/ Priya, MS. email Jordan";
    expect(validateExtraction(priyaAndJordan("Evercore"), note, TODAY)).toContainEqual(
      expect.objectContaining({ code: "ungrounded", field: "referrals[0].firmText" }),
    );
  });
});
