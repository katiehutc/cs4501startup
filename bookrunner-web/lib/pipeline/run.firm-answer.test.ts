import { describe, expect, it } from "vitest";
import type { FirmMatch } from "../contracts";
import { runPipeline } from "./run";
import { GOLDMAN, GUGGENHEIM, MORGAN, TODAY, extraction, makeDeps, resolverFor } from "./run.fixtures";

const NOTE = "coffee w/ Sam, analyst, GS, TMT";
const ANSWERED = `${NOTE}\nFirm: Goldman Sachs`;

const KNOWN: Record<string, FirmMatch> = {
  GS: { kind: "ambiguous", options: [GOLDMAN, GUGGENHEIM] },
  "Goldman Sachs": { kind: "match", firm: GOLDMAN },
  "Morgan Stanley": { kind: "match", firm: MORGAN },
  MS: { kind: "match", firm: MORGAN },
};

const SAM = { name: "Sam", title: "Analyst", firmText: "GS", group: "TMT", city: null };

function depsReturningGs() {
  const deps = makeDeps();
  deps.resolveFirm.mockImplementation(resolverFor(KNOWN));
  deps.extract.mockResolvedValue(extraction({ contact: SAM, evidence: { "contact.firmText": "GS" } }));
  return deps;
}

describe("#46 runPipeline firm answers", () => {
  it("[ai] uses the student's answer even when the model repeats the shorthand, so it never asks twice", async () => {
    const deps = depsReturningGs();
    const result = await runPipeline(ANSWERED, TODAY, deps);
    expect(result).toMatchObject({
      kind: "ok",
      attempts: 1,
      extraction: { contact: { firmText: "Goldman Sachs" }, evidence: { "contact.firmText": "Goldman Sachs" } },
    });
    expect(deps.extract).toHaveBeenCalledTimes(1);
    expect(deps.draft.mock.calls[0][0]).toMatchObject({ firmId: GOLDMAN.id });
  });

  it("[ai] validates the corrected extraction, not what the model returned", async () => {
    const deps = depsReturningGs();
    await runPipeline(ANSWERED, TODAY, deps);
    expect(deps.validateExtraction.mock.calls[0][0].contact.firmText).toBe("Goldman Sachs");
  });

  it("[ai] applies the answer to a referral with the ambiguous firm and leaves the contact alone", async () => {
    const deps = makeDeps();
    deps.resolveFirm.mockImplementation(resolverFor(KNOWN));
    deps.extract.mockResolvedValue(
      extraction({
        contact: { ...SAM, firmText: "MS" },
        referrals: [{ name: "Jordan", title: null, firmText: "GS", group: null, city: null }],
      }),
    );
    const result = await runPipeline(ANSWERED, TODAY, deps);
    expect(result).toMatchObject({
      kind: "ok",
      extraction: { contact: { firmText: "MS" }, referrals: [{ firmText: "Goldman Sachs" }] },
    });
  });

  it("[ai] ignores an answer that isn't one of the ambiguous firm's options", async () => {
    const deps = depsReturningGs();
    const result = await runPipeline(`${NOTE}\nFirm: Morgan Stanley`, TODAY, deps);
    expect(result.kind).toBe("question");
  });

  it("[ai] ignores a Firm: line that isn't the note's last line", async () => {
    const deps = depsReturningGs();
    const result = await runPipeline(`Firm: Goldman Sachs\n${NOTE}`, TODAY, deps);
    expect(result.kind).toBe("question");
  });

  it("[ai] still asks when there's no answer in the note", async () => {
    const deps = depsReturningGs();
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result.kind).toBe("question");
  });
});
