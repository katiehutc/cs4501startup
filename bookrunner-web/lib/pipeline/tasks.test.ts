import { describe, expect, it } from "vitest";
import type { Extraction } from "../contracts";
import { tasksFromExtraction } from "./tasks";

function extraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    contact: { name: "Chris", title: "Analyst", firmText: "GS", group: "FIG", city: "New York" },
    chatDate: "2026-10-21",
    referrals: [],
    followUp: { afterDays: 21, reason: "follow up in 3 wks" },
    evidence: {},
    ...overrides,
  };
}

describe("#47 tasksFromExtraction", () => {
  it("[ai] creates a thank_you task due chat date + 1 day", () => {
    const tasks = tasksFromExtraction(extraction(), "c1");
    expect(tasks.find((task) => task.kind === "thank_you")).toMatchObject({ contactId: "c1", due: "2026-10-22" });
  });

  it("[ai] creates a follow_up task due chat date + afterDays", () => {
    const tasks = tasksFromExtraction(extraction(), "c1");
    expect(tasks.find((task) => task.kind === "follow_up")).toMatchObject({ contactId: "c1", due: "2026-11-11" });
  });

  it("[ai] creates no follow_up task when followUp is null (tricky note 4)", () => {
    const tasks = tasksFromExtraction(extraction({ followUp: null }), "c1");
    expect(tasks.map((task) => task.kind)).toEqual(["thank_you"]);
  });

  it("[ai] creates no tasks for referrals (tricky note 3)", () => {
    const referrals = [{ name: "Jordan", title: "Analyst", firmText: "MS", group: null, city: null }];
    const tasks = tasksFromExtraction(extraction({ referrals }), "c1");
    expect(tasks).toHaveLength(2);
    expect(tasks.every((task) => task.contactId === "c1")).toBe(true);
  });

  it.each([
    ["the end of a month", "2026-10-31", "2026-11-01"],
    ["the end of a year", "2026-12-31", "2027-01-01"],
    ["a leap day", "2028-02-28", "2028-02-29"],
    ["a non-leap February", "2027-02-28", "2027-03-01"],
  ])("[ai] rolls the thank-you date over %s", (_label, chatDate, due) => {
    const [thankYou] = tasksFromExtraction(extraction({ chatDate, followUp: null }), "c1");
    expect(thankYou.due).toBe(due);
  });

  it("[ai] rolls a follow-up across a year boundary", () => {
    const tasks = tasksFromExtraction(extraction({ chatDate: "2026-12-20", followUp: { afterDays: 21, reason: "r" } }), "c1");
    expect(tasks.find((task) => task.kind === "follow_up")?.due).toBe("2027-01-10");
  });

  it("[ai] names the contact in both labels and gives the follow-up's reason", () => {
    const [thankYou, followUp] = tasksFromExtraction(extraction(), "c1");
    expect(thankYou.label).toContain("Chris");
    expect(followUp.label).toContain("Chris");
    expect(followUp.label).toContain("follow up in 3 wks");
  });

  it("[ai] gives tasks ids that differ within a contact and across contacts", () => {
    const ids = [...tasksFromExtraction(extraction(), "c1"), ...tasksFromExtraction(extraction(), "c2")].map((task) => task.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("[ai] is pure: same input, same output, and the input is unchanged", () => {
    const input = extraction();
    const copy = structuredClone(input);
    expect(tasksFromExtraction(input, "c1")).toEqual(tasksFromExtraction(input, "c1"));
    expect(input).toEqual(copy);
  });
});
