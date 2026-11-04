import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS } from "../contracts";
import { runPipeline } from "./run";
import { GOLDMAN, MORGAN, NOTE, TODAY, draft, error, extraction, makeDeps, resolverFor } from "./run.fixtures";

describe("#46 runPipeline drafting", () => {
  it("[ai] returns the validated extraction and draft together", async () => {
    const deps = makeDeps();
    const expected = draft({ greetingName: "Chris" });
    deps.draft.mockResolvedValue(expected);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toEqual({ kind: "ok", extraction: extraction(), draft: expected, attempts: 1, trace: [] });
  });

  it("[ai] builds the draft's contact from the extraction, the resolved firm and the note", async () => {
    const deps = makeDeps();
    await runPipeline(NOTE, TODAY, deps);
    const [contact, note, previousErrors] = deps.draft.mock.calls[0];
    expect(contact).toMatchObject({
      name: "Chris",
      title: "Analyst",
      firmId: GOLDMAN.id,
      group: "FIG",
      city: "New York",
      notes: NOTE,
    });
    expect(note).toBe(NOTE);
    expect(previousErrors).toEqual([]);
  });

  it("[ai] gives the draft validator the draft, the note and the same contact", async () => {
    const deps = makeDeps();
    const written = draft();
    deps.draft.mockResolvedValue(written);
    await runPipeline(NOTE, TODAY, deps);
    expect(deps.validateDraft).toHaveBeenCalledWith(written, NOTE, deps.draft.mock.calls[0][0]);
  });

  it("[ai] turns missing title, group and city into strings for the Contact type", async () => {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(extraction({ contact: { name: "Chris", title: null, firmText: "Goldman", group: null, city: null } }));
    await runPipeline("coffee w/ Chris at Goldman", TODAY, deps);
    const [contact] = deps.draft.mock.calls[0];
    expect([typeof contact.title, typeof contact.group, typeof contact.city]).toEqual(["string", "string", "string"]);
  });

  it("[ai] writes to the person the student met, not the referral (tricky note 3)", async () => {
    const deps = makeDeps();
    const twoPeople = extraction({
      contact: { name: "Priya", title: "VP", firmText: "MS", group: "M&A", city: null },
      referrals: [{ name: "Jordan", title: "Analyst", firmText: "MS", group: null, city: null }],
    });
    deps.extract.mockResolvedValue(twoPeople);
    deps.resolveFirm.mockImplementation(resolverFor({ MS: { kind: "match", firm: MORGAN } }));
    const result = await runPipeline("talked to Priya (VP MS M&A), she said email her analyst Jordan", TODAY, deps);
    expect(deps.draft.mock.calls[0][0]).toMatchObject({ name: "Priya", firmId: MORGAN.id });
    expect(result).toMatchObject({ kind: "ok", extraction: twoPeople });
  });

  it("[ai] keeps followUp null when the note mentions no follow-up (tricky note 4)", async () => {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(extraction({ followUp: null }));
    const result = await runPipeline("coffee w/ Chris at Goldman", TODAY, deps);
    expect(result.kind === "ok" && result.extraction.followUp).toBeNull();
  });

  it("[ai] rewrites only the draft when a deal claim is ungrounded (tricky note 5)", async () => {
    const deps = makeDeps();
    const problem = error("ungrounded", "claims[0]");
    const clean = draft({ paragraphs: ["Thanks for your time."] });
    deps.draft.mockResolvedValueOnce(draft({ paragraphs: ["Great discussing the deal we worked on."] })).mockResolvedValueOnce(clean);
    deps.validateDraft.mockReturnValueOnce([problem]);
    const result = await runPipeline("he mentioned the Acme deal", TODAY, deps);
    expect(deps.extract).toHaveBeenCalledTimes(1);
    expect(deps.draft.mock.calls[1][2]).toEqual([problem]);
    expect(result).toMatchObject({ kind: "ok", draft: clean, attempts: 2, trace: [[problem]] });
  });

  it("[ai] doesn't send extraction errors to the draft writer", async () => {
    const deps = makeDeps();
    deps.validateExtraction.mockReturnValueOnce([error("schema", "chatDate")]);
    await runPipeline(NOTE, TODAY, deps);
    expect(deps.draft.mock.calls[0][2]).toEqual([]);
  });

  it("[ai] shares one MAX_ATTEMPTS budget between extraction and draft failures", async () => {
    const deps = makeDeps();
    const [a, b, c] = [[error("schema", "chatDate")], [error("placeholder", "paragraphs")], [error("recipient_mismatch", "greetingName")]];
    deps.validateExtraction.mockReturnValueOnce(a);
    deps.validateDraft.mockReturnValueOnce(b).mockReturnValueOnce(c);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toEqual({ kind: "failed", errors: c, attempts: MAX_ATTEMPTS, trace: [a, b, c] });
    expect(deps.extract).toHaveBeenCalledTimes(2);
    expect(deps.draft).toHaveBeenCalledTimes(2);
  });

  it("[ai] returns failed and never the rejected draft when every draft fails", async () => {
    const deps = makeDeps();
    const problem = [error("placeholder", "paragraphs")];
    deps.validateDraft.mockReturnValue(problem);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toEqual({ kind: "failed", errors: problem, attempts: MAX_ATTEMPTS, trace: [problem, problem, problem] });
    expect(deps.draft).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("[ai] lets a draft writer failure propagate", async () => {
    const deps = makeDeps();
    const failure = new Error("API down");
    deps.draft.mockRejectedValueOnce(failure);
    await expect(runPipeline(NOTE, TODAY, deps)).rejects.toBe(failure);
  });
});
