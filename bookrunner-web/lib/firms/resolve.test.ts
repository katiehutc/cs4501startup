import { describe, expect, it } from "vitest";
import { resolveFirm } from "./resolve";
import { FIRMS, GROUPS, TITLES } from "./data";

describe("#40 resolveFirm", () => {
  it("[ai] matches a full firm name", () => {
    const result = resolveFirm("Goldman Sachs");

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.firm.name).toBe("Goldman Sachs");
    }
  });

  it("[ai] matches a firm alias", () => {
    const result = resolveFirm("Goldman");

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.firm.name).toBe("Goldman Sachs");
    }
  });

  it("[ai] ignores capitalization", () => {
    const result = resolveFirm("gOlDmAn SaChS");

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.firm.id).toBe("gs");
    }
  });

  it("[ai] ignores punctuation", () => {
    const result = resolveFirm("Goldman-Sachs!!!");

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.firm.id).toBe("gs");
    }
  });

  it("[ai] resolves an unambiguous abbreviation", () => {
    const result = resolveFirm("MS");

    expect(result.kind).toBe("match");
    if (result.kind === "match") {
      expect(result.firm.name).toBe("Morgan Stanley");
    }
  });

  it("[ai] returns ambiguity for bare GS", () => {
    const result = resolveFirm("GS");

    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.options.map((firm) => firm.name).sort()).toEqual([
        "Goldman Sachs",
        "Guggenheim Securities",
      ]);
    }
  });

  it("[ai] returns ambiguity for lowercase gs", () => {
    const result = resolveFirm("gs");

    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.options).toHaveLength(2);
    }
  });

  it("[ai] returns unknown for an unlisted boutique", () => {
    const result = resolveFirm("Unknown Boutique Bank");

    expect(result).toEqual({
      kind: "unknown",
      text: "Unknown Boutique Bank",
    });
  });

  it("[ai] returns unknown for empty input", () => {
    expect(resolveFirm("")).toEqual({
      kind: "unknown",
      text: "",
    });
  });

  it("[ai] returns unknown for whitespace-only input", () => {
    expect(resolveFirm("   ").kind).toBe("unknown");
  });

  it("[ai] does not guess from partial names", () => {
    expect(resolveFirm("Gold").kind).toBe("unknown");
  });

  it("[ai] contains at least 20 banks", () => {
    expect(FIRMS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FIRMS.map((firm) => firm.id)).size).toBe(
      FIRMS.length,
    );
  });

  it("[ai] includes all three bank tiers", () => {
    expect(new Set(FIRMS.map((firm) => firm.tier))).toEqual(
      new Set([
        "Bulge bracket",
        "Elite boutique",
        "Middle market",
      ]),
    );
  });

  it("[ai] provides aliases for each bank", () => {
    for (const firm of FIRMS) {
      expect(firm.aliases.length).toBeGreaterThan(0);
    }
  });

  it("[ai] includes the standard banking groups", () => {
    expect(GROUPS).toEqual(
      expect.arrayContaining([
        "M&A",
        "FIG",
        "TMT",
        "Healthcare",
        "Industrials",
        "Consumer & Retail",
        "Energy",
        "Real Estate",
        "Restructuring",
        "LevFin",
        "ECM",
        "DCM",
      ]),
    );
  });

  it("[ai] includes the standard title ladder", () => {
    expect(TITLES).toEqual([
      "Analyst",
      "Associate",
      "VP",
      "Director",
      "MD",
    ]);
  });
  it("[ai] recognizes newly supported firms and aliases", () => {
    const cases = [
      ["PWP", "pwp"],
      ["Perella Weinberg", "pwp"],
      ["Truist", "truist"],
      ["Truist Securities", "truist"],
      ["Canaccord", "cgf"],
      ["Cannacord", "cgf"],
      ["CGF", "cgf"],
      ["Gugg", "gugg"],
      ["Jeff", "jeff"],
    ];

    for (const [input, expectedId] of cases) {
      const result = resolveFirm(input);

      expect(result.kind).toBe("match");

      if (result.kind === "match") {
        expect(result.firm.id).toBe(expectedId);
      }
    }
  });
});
