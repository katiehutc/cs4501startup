import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS } from "../contracts";
import type { FirmMatch } from "../contracts";
import { runPipeline } from "./run";
import { GOLDMAN, GUGGENHEIM, MORGAN, NOTE, TODAY, error, extraction, makeDeps, resolverFor } from "./run.fixtures";

const AMBIGUOUS_GS: FirmMatch = { kind: "ambiguous", options: [GOLDMAN, GUGGENHEIM] };

describe("#46 runPipeline extraction retries", () => {
  it("[ai] returns ok on a clean first attempt with an empty trace", async () => {
    const deps = makeDeps();
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toMatchObject({ kind: "ok", attempts: 1, trace: [] });
    expect(deps.extract).toHaveBeenCalledWith(NOTE, TODAY, []);
    expect(deps.validateExtraction).toHaveBeenCalledWith(extraction(), NOTE, TODAY);
  });

  it("[ai] calls the extractor again with the errors, and a pass on attempt 2 returns attempts: 2", async () => {
    const deps = makeDeps();
    const problems = [error("title_invalid", "contact.title")];
    deps.validateExtraction.mockReturnValueOnce(problems);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(deps.extract).toHaveBeenCalledTimes(2);
    expect(deps.extract).toHaveBeenLastCalledWith(NOTE, TODAY, problems);
    expect(result).toMatchObject({ kind: "ok", attempts: 2, trace: [problems] });
  });

  it("[ai] returns the extraction that passed, not an earlier rejected one", async () => {
    const deps = makeDeps();
    const good = extraction({ chatDate: "2026-10-20" });
    deps.extract.mockResolvedValueOnce(extraction({ chatDate: "bad" })).mockResolvedValueOnce(good);
    deps.validateExtraction.mockReturnValueOnce([error("schema", "chatDate")]);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toMatchObject({ kind: "ok", extraction: good });
  });

  it("[ai] can still pass on the last allowed attempt", async () => {
    const deps = makeDeps();
    deps.validateExtraction
      .mockReturnValueOnce([error("schema", "chatDate")])
      .mockReturnValueOnce([error("ungrounded", "contact.city")]);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toMatchObject({ kind: "ok", attempts: MAX_ATTEMPTS });
  });

  it("[ai] feeds back only the latest attempt's errors and records each attempt in trace", async () => {
    const deps = makeDeps();
    const first = [error("schema", "chatDate")];
    const second = [error("ungrounded", "contact.city")];
    deps.validateExtraction.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(deps.extract.mock.calls.map((call) => call[2])).toEqual([[], first, second]);
    expect(result.trace).toEqual([first, second]);
  });

  it("[ai] returns failed with the last errors after MAX_ATTEMPTS and exposes no unvalidated data", async () => {
    const deps = makeDeps();
    const [a, b, c] = [[error("schema", "a")], [error("schema", "b")], [error("schema", "c")]];
    deps.validateExtraction.mockReturnValueOnce(a).mockReturnValueOnce(b).mockReturnValueOnce(c);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result).toEqual({ kind: "failed", errors: c, attempts: MAX_ATTEMPTS, trace: [a, b, c] });
    expect(deps.extract).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(deps.draft).not.toHaveBeenCalled();
  });

  it("[ai] lets an LLM failure propagate without retrying, so the route can return 502", async () => {
    const deps = makeDeps();
    const failure = new Error("API down");
    deps.extract.mockRejectedValueOnce(failure);
    await expect(runPipeline(NOTE, TODAY, deps)).rejects.toBe(failure);
    expect(deps.extract).toHaveBeenCalledTimes(1);
  });

  it.each(["", "   \n\t "])("[ai] fails an empty note (%j) without spending an LLM call", async (note) => {
    const deps = makeDeps();
    const result = await runPipeline(note, TODAY, deps);
    expect(result).toMatchObject({ kind: "failed", attempts: 0, trace: [] });
    expect(result.kind === "failed" && result.errors[0].code).toBe("schema");
    expect(deps.extract).not.toHaveBeenCalled();
  });
});

describe("#46 runPipeline firm questions", () => {
  function ambiguousDeps() {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(
      extraction({ contact: { name: "Sam", title: null, firmText: "GS", group: "TMT", city: null } }),
    );
    deps.resolveFirm.mockImplementation(resolverFor({ GS: AMBIGUOUS_GS }));
    return deps;
  }

  it("[ai] returns a question naming the options for an ambiguous firm, with no retry and no draft", async () => {
    const deps = ambiguousDeps();
    const problem = error("firm_ambiguous");
    deps.validateExtraction.mockReturnValue([problem]);
    const result = await runPipeline("coffee w/ Sam, GS, TMT", TODAY, deps);
    expect(result).toMatchObject({
      kind: "question",
      options: ["Goldman Sachs", "Guggenheim Securities"],
      attempts: 1,
      trace: [[problem]],
    });
    expect(result.kind === "question" && result.prompt).toContain("GS");
    expect(deps.extract).toHaveBeenCalledTimes(1);
    expect(deps.draft).not.toHaveBeenCalled();
  });

  it("[ai] asks the question even when other errors come with the ambiguity", async () => {
    const deps = ambiguousDeps();
    deps.validateExtraction.mockReturnValue([error("title_invalid", "contact.title"), error("firm_ambiguous")]);
    const result = await runPipeline("coffee w/ Sam, GS, TMT", TODAY, deps);
    expect(result.kind).toBe("question");
    expect(deps.extract).toHaveBeenCalledTimes(1);
  });

  it("[ai] counts earlier failed attempts when the ambiguity appears on attempt 2", async () => {
    const deps = ambiguousDeps();
    const first = [error("schema", "chatDate")];
    const second = [error("firm_ambiguous")];
    deps.validateExtraction.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const result = await runPipeline("coffee w/ Sam, GS, TMT", TODAY, deps);
    expect(result).toMatchObject({ kind: "question", attempts: 2, trace: [first, second] });
  });

  it("[ai] asks about a referral's firm when that's the ambiguous one", async () => {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(
      extraction({
        contact: { name: "Priya", title: "VP", firmText: "MS", group: "M&A", city: null },
        referrals: [{ name: "Jordan", title: "Analyst", firmText: "GS", group: null, city: null }],
      }),
    );
    deps.resolveFirm.mockImplementation(resolverFor({ MS: { kind: "match", firm: MORGAN }, GS: AMBIGUOUS_GS }));
    deps.validateExtraction.mockReturnValue([error("firm_ambiguous", "referrals[0].firmText")]);
    const result = await runPipeline("talked to Priya", TODAY, deps);
    expect(result).toMatchObject({ kind: "question", options: ["Goldman Sachs", "Guggenheim Securities"] });
  });

  it("[ai] never asks a question with no options when the validator and resolver disagree", async () => {
    const deps = makeDeps();
    deps.validateExtraction.mockReturnValue([error("firm_ambiguous")]);
    const result = await runPipeline(NOTE, TODAY, deps);
    expect(result.kind).toBe("failed");
  });

  it("[ai] asks instead of drafting when the validator passes but the resolver says ambiguous", async () => {
    const deps = ambiguousDeps();
    const result = await runPipeline("coffee w/ Sam, GS, TMT", TODAY, deps);
    expect(result.kind).toBe("question");
    expect(deps.draft).not.toHaveBeenCalled();
  });

  it("[ai] flags an unknown boutique as failed with firm_unknown and never drafts for an invented firm", async () => {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(extraction({ contact: { name: "Lee", title: null, firmText: "Acme Partners", group: null, city: null } }));
    const problem = error("firm_unknown");
    deps.validateExtraction.mockReturnValue([problem]);
    const result = await runPipeline("coffee w/ Lee at Acme Partners", TODAY, deps);
    expect(result).toMatchObject({ kind: "failed", errors: [problem], attempts: MAX_ATTEMPTS });
    expect(deps.draft).not.toHaveBeenCalled();
  });

  it("[ai] doesn't draft when the validator passes but the resolver doesn't know the firm", async () => {
    const deps = makeDeps();
    deps.extract.mockResolvedValue(extraction({ contact: { name: "Lee", title: null, firmText: "Acme Partners", group: null, city: null } }));
    const result = await runPipeline("coffee w/ Lee at Acme Partners", TODAY, deps);
    expect(result.kind).toBe("failed");
    expect(result.kind === "failed" && result.errors.map((e) => e.code)).toContain("firm_unknown");
    expect(deps.draft).not.toHaveBeenCalled();
  });
});
