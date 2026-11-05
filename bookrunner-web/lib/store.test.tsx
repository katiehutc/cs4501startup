import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { useStore, StoreProvider } from "./store";
import type { Extraction } from "./contracts";
import type { Draft, ProposalKind } from "./types";

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


function ApprovalTestStore({
  accepted,
  acceptedIds,
  draft,
  data,
}: {
  accepted: ProposalKind[];
  acceptedIds?: string[];
  draft?: Draft;
  data: Extraction;
}) {
  const { state, dispatch } = useStore();

  return (
    <div>
      <button
        onClick={() =>
          dispatch({
            type: "apply_extraction",
            firmId: "gs",
            note: "Talked with Alex. Alex referred me to Jordan and Taylor.",
            accepted,
            acceptedIds,
            extraction: data,
            draft,
          })
        }
      >
        Apply approved updates
      </button>
      <pre data-testid="store-state">
        {JSON.stringify(state)}
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


describe("#integration individual proposal approval", () => {
  it("[ai] saves only selected referrals", () => {
    const data: Extraction = {
      ...extraction,
      referrals: [
        extraction.referrals[0],
        {
          name: "Taylor",
          title: "Associate",
          firmText: "Goldman Sachs",
          group: "FIG",
          city: "New York",
        },
      ],
    };

    render(
      <StoreProvider>
        <ApprovalTestStore
          accepted={["new_contact", "new_lead"]}
          acceptedIds={["contact", "referral-0"]}
          data={data}
        />
      </StoreProvider>
    );

    fireEvent.click(screen.getByText("Apply approved updates"));

    const state = JSON.parse(
      screen.getByTestId("store-state").textContent ?? "{}"
    );

    expect(state.contacts.some((c: { name: string }) => c.name === "Jordan")).toBe(true);
    expect(state.contacts.some((c: { name: string }) => c.name === "Taylor")).toBe(false);
  });

  it("[ai] does not save an unchecked draft", () => {
    const draft: Draft = {
      contactId: "alex",
      greetingName: "Alex",
      paragraphs: ["Thanks for taking the time to chat."],
      claims: [],
      signoff: "Best,",
      removed: [],
    };

    render(
      <StoreProvider>
        <ApprovalTestStore
          accepted={["new_contact", "log_chat"]}
          acceptedIds={["contact", "chat"]}
          data={extraction}
          draft={draft}
        />
      </StoreProvider>
    );

    fireEvent.click(screen.getByText("Apply approved updates"));

    const state = JSON.parse(
      screen.getByTestId("store-state").textContent ?? "{}"
    );

    const alex = state.contacts.find(
      (c: { name: string }) => c.name === "Alex"
    );

    expect(state.drafts.some((d: Draft) => d.contactId === alex.id)).toBe(false);
    expect(
      state.tasks.some(
        (t: { contactId: string; kind: string }) =>
          t.contactId === alex.id && t.kind === "thank_you"
      )
    ).toBe(false);
  });

  it("[ai] creates a follow-up task when approved", () => {
    const data: Extraction = {
      ...extraction,
      followUp: {
        afterDays: 14,
        reason: "Check in after coffee chat",
      },
    };

    render(
      <StoreProvider>
        <ApprovalTestStore
          accepted={["new_contact", "follow_up"]}
          acceptedIds={["contact", "follow-up"]}
          data={data}
        />
      </StoreProvider>
    );

    fireEvent.click(screen.getByText("Apply approved updates"));

    const state = JSON.parse(
      screen.getByTestId("store-state").textContent ?? "{}"
    );

    const alex = state.contacts.find(
      (c: { name: string }) => c.name === "Alex"
    );

    expect(
      state.tasks.some(
        (t: { contactId: string; kind: string; due: string }) =>
          t.contactId === alex.id &&
          t.kind === "follow_up" &&
          t.due === "2026-11-18"
      )
    ).toBe(true);
  });


it("[ai] saves an approved draft and creates a thank-you task", () => {
  const draft: Draft = {
    contactId: "temporary",
    greetingName: "Alex",
    paragraphs: ["Thanks for taking the time to chat."],
    claims: [],
    signoff: "Best,",
    removed: [],
  };

  render(
    <StoreProvider>
      <ApprovalTestStore
        accepted={["new_contact", "draft"]}
        acceptedIds={["contact", "draft"]}
        data={extraction}
        draft={draft}
      />
    </StoreProvider>
  );

  fireEvent.click(screen.getByText("Apply approved updates"));

  const state = JSON.parse(
    screen.getByTestId("store-state").textContent ?? "{}"
  );

  const alex = state.contacts.find(
    (c: { name: string }) => c.name === "Alex"
  );

  expect(alex).toBeDefined();

  expect(
    state.drafts.some(
      (d: Draft) =>
        d.contactId === alex.id &&
        d.greetingName === "Alex"
    )
  ).toBe(true);

  expect(
    state.tasks.some(
      (t: { contactId: string; kind: string }) =>
        t.contactId === alex.id && t.kind === "thank_you"
    )
  ).toBe(true);
});

});

afterEach(() => {
  cleanup();
});

