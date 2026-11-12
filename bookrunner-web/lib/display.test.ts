import { describe, expect, it } from "vitest";
import { banksCovered, contactLine } from "./display";

const gs = { id: "gs", name: "Goldman Sachs", tier: "Bulge bracket" as const, aliases: ["GS"] };

describe("contactLine", () => {
  it("[ai] joins the contact's details with dots", () => {
    expect(contactLine(["Analyst", gs, "FIG", "New York"])).toBe("Analyst · Goldman Sachs · FIG · New York");
  });

  it("[ai] says 'Firm unknown' for a referral whose firm isn't on the list", () => {
    expect(contactLine(["Associate", undefined, "FIG"])).toBe("Associate · Firm unknown · FIG");
  });

  it("[ai] skips blank details instead of leaving empty dots", () => {
    expect(contactLine(["", gs, "", "New York"])).toBe("Goldman Sachs · New York");
  });
});

describe("banksCovered", () => {
  it("[ai] counts each firm once", () => {
    expect(banksCovered([{ firmId: "gs" }, { firmId: "gs" }, { firmId: "ms" }])).toBe(2);
  });

  it("[ai] doesn't count contacts with an unknown firm as a bank", () => {
    expect(banksCovered([{ firmId: "gs" }, { firmId: "" }])).toBe(1);
  });
});
