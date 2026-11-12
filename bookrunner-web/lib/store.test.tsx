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

function MarkSentTestStore() {
  const { state, dispatch } = useStore();

  const alex = state.contacts.find((c) => c.name === "Alex");
  const thankYouTasks = state.tasks.filter(
    (task) => task.contactId === alex?.id && task.kind === "thank_you"
  );

  return (
    <div>
      <span data-testid="thank-you-count">{thankYouTasks.length}</span>
      <span data-testid="alex-status">{alex?.status ?? ""}</span>

      <button
        onClick={() =>
          dispatch({
            type: "apply_extraction",
            firmId: "gs",
            note: "Talked with Alex at Goldman Sachs.",
            accepted: ["new_contact", "draft"],
            extraction,
            draft: {
              contactId: "alex",
              greetingName: "Alex",
              paragraphs: ["Thanks for chatting!"],
              claims: [],
              signoff: "Best,",
              removed: [],
            },
          })
        }
      >
        Save chat
      </button>

      <button
        onClick={() =>
          alex && dispatch({ type: "mark_sent", contactId: alex.id })
        }
      >
        Mark as sent
      </button>
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

describe("#50 mark sent", () => {
  it("[ai] completes the thank-you task when the draft is marked sent", () => {
    render(
      <StoreProvider>
        <MarkSentTestStore />
      </StoreProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Save chat" }));

    expect(screen.getByTestId("thank-you-count").textContent).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Mark as sent" }));

    expect(screen.getByTestId("thank-you-count").textContent).toBe("0");
    expect(screen.getByTestId("alex-status").textContent).toBe(
      "Thank-you sent"
    );
  });
});

describe("saving the same chat twice", () => {
  afterEach(() => cleanup());

  const thankYouDraft: Draft = {
    contactId: "alex",
    greetingName: "Alex",
    paragraphs: ["Thanks for chatting!"],
    claims: [],
    signoff: "Best,",
    removed: [],
  };

  function saveTwice(accepted: ProposalKind[], data: Extraction = extraction) {
    render(
      <StoreProvider>
        <ApprovalTestStore accepted={accepted} data={data} draft={thankYouDraft} />
      </StoreProvider>,
    );
    const button = screen.getByText("Apply approved updates");
    fireEvent.click(button);
    fireEvent.click(button);
    return JSON.parse(screen.getByTestId("store-state").textContent ?? "{}") as {
      contacts: { id: string; name: string; firmId: string; notes: string; timeline: unknown[] }[];
      tasks: { contactId: string; kind: string }[];
      drafts: { contactId: string }[];
    };
  }

  it("keeps one contact per person at a firm and logs the second chat on it", () => {
    const state = saveTwice(["new_contact", "log_chat"]);
    const alexes = state.contacts.filter((c) => c.name === "Alex" && c.firmId === "gs");
    expect(alexes).toHaveLength(1);
    expect(alexes[0].timeline).toHaveLength(2);
  });

  function TwoSaves({ first, second }: { first: { firmId: string; name: string }; second: { firmId: string; name: string } }) {
    const { state, dispatch } = useStore();
    const save = (s: { firmId: string; name: string }) =>
      dispatch({
        type: "apply_extraction",
        firmId: s.firmId,
        note: "Talked with Alex.",
        accepted: ["new_contact"],
        extraction: { ...extraction, referrals: [], contact: { ...extraction.contact, name: s.name } },
      });
    return (
      <div>
        <button onClick={() => { save(first); save(second); }}>Save both</button>
        <pre data-testid="contacts">{JSON.stringify(state.contacts)}</pre>
      </div>
    );
  }

  function alexesAfter(first: { firmId: string; name: string }, second: { firmId: string; name: string }) {
    render(
      <StoreProvider>
        <TwoSaves first={first} second={second} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("Save both"));
    const contacts = JSON.parse(screen.getByTestId("contacts").textContent ?? "[]") as { name: string; firmId: string }[];
    return contacts.filter((c) => c.name.trim().toLowerCase() === "alex");
  }

  it("matches names regardless of case and extra spaces", () => {
    expect(alexesAfter({ firmId: "gs", name: "Alex" }, { firmId: "gs", name: "  alex " })).toHaveLength(1);
  });

  it("still adds a same-named person at a different firm", () => {
    const alexes = alexesAfter({ firmId: "gs", name: "Alex" }, { firmId: "ms", name: "Alex" });
    expect(alexes.map((c) => c.firmId).sort()).toEqual(["gs", "ms"]);
  });

  it("doesn't stack a second thank-you task or draft for the same contact", () => {
    const state = saveTwice(["new_contact", "draft"]);
    const alexIds = state.contacts.filter((c) => c.name === "Alex" && c.firmId === "gs").map((c) => c.id);
    expect(state.tasks.filter((t) => alexIds.includes(t.contactId) && t.kind === "thank_you")).toHaveLength(1);
    expect(state.drafts.filter((d) => alexIds.includes(d.contactId))).toHaveLength(1);
  });

  it("doesn't duplicate a referral or their reach-out task", () => {
    const state = saveTwice(["new_contact", "new_lead"]);
    const jordans = state.contacts.filter((c) => c.name === "Jordan");
    expect(jordans).toHaveLength(1);
    expect(state.tasks.filter((t) => t.contactId === jordans[0].id && t.kind === "reach_out")).toHaveLength(1);
  });
});
