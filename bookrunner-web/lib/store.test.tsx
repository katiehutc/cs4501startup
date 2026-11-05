import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useStore, StoreProvider } from "./store";
import type { Extraction } from "./contracts";

const extraction: Extraction = {
  contact: {
    name: "Alex",
    title: "Analyst",
    firmText: "Goldman Sachs",
    group: "FIG",
    city: "New York",
  },
  chatDate: "2026-11-04",
  referrals: [
    {
      name: "Jordan",
      title: "Associate",
      firmText: "Goldman Sachs",
      group: "FIG",
      city: "New York",
    },
  ],
  followUp: null,
  evidence: {},
};

function TestStore() {
  const { state, dispatch } = useStore();

  return (
    <div>
      <button
        onClick={() =>
          dispatch({
            type: "apply_extraction",
            firmId: "gs",
            note: "Talked with Alex. Alex referred me to Jordan.",
            accepted: ["new_contact", "new_lead"],
            extraction,
          })
        }
      >
        Save extraction
      </button>
      <pre data-testid="contacts">
        {JSON.stringify(state.contacts)}
      </pre>
    </div>
  );
}

describe("#49 referral attribution", () => {
  it("[ai] saves the extracted referrer instead of hardcoding Chris", () => {
    render(
      <StoreProvider>
        <TestStore />
      </StoreProvider>
    );

    fireEvent.click(screen.getByText("Save extraction"));

    const contacts = JSON.parse(
      screen.getByTestId("contacts").textContent ?? "[]"
    );

    const alex = contacts.find(
      (contact: { name: string }) => contact.name === "Alex"
    );

    const jordan = contacts.find(
      (contact: { name: string }) => contact.name === "Jordan"
    );

    expect(alex).toBeDefined();
    expect(jordan).toBeDefined();
    expect(jordan.referredBy).toBe(alex.id);
    expect(jordan.status).toBe("Referred by Alex");
    expect(jordan.timeline[0].text).toContain("Alex");
  });
});
