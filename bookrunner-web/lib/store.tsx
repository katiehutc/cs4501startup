"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";import { addDays, TODAY } from "./dates";
import type { Extraction } from "./contracts";
import { CONTACTS, DRAFTS, FIRMS, TASKS } from "./mock-data";
import type { Contact, Draft, Firm, ProposalKind, Stage, Task } from "./types";
import { resolveFirm } from "./firms/resolve";

interface State {
  firms: Firm[];
  contacts: Contact[];
  tasks: Task[];
  drafts: Draft[];
  senderName: string;
}

type Action =
  | { type: "complete_task"; id: string }
  | { type: "snooze_task"; id: string }
  | { type: "set_stage"; contactId: string; stage: Stage }
  | { type: "set_sender"; name: string }
  | { type: "mark_sent"; contactId: string }
  | {
    type: "apply_extraction";
    firmId: string;
    note: string;
    accepted: ProposalKind[];
    extraction?: Extraction;
    acceptedIds?: string[];
    draft?: Draft;
  };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "complete_task":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case "snooze_task":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, due: addDays(t.due < TODAY ? TODAY : t.due, 1) } : t)),
      };
    case "set_stage":
      return {
        ...state,
        contacts: state.contacts.map((c) => (c.id === action.contactId ? { ...c, stage: action.stage } : c)),
      };
    case "set_sender":
      return { ...state, senderName: action.name };
    case "mark_sent":
      return {
        ...state,
        tasks: state.tasks.filter((t) => !(t.contactId === action.contactId && t.kind === "thank_you")),
        contacts: state.contacts.map((c) =>
          c.id === action.contactId
            ? { ...c, status: "Thank-you sent", urgent: false, timeline: [{ date: TODAY, text: "Thank-you sent" }, ...c.timeline] }
            : c,
        ),
      };
    case "apply_extraction":
    return applyExtraction(
      state,
      action.firmId,
      action.note,
      action.accepted,
      action.extraction,
      action.acceptedIds,
      action.draft
    );
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// One record per person at a firm, so saving the same notes twice doesn't create duplicates.
function findContact(contacts: Contact[], name: string, firmId: string): Contact | undefined {
  return contacts.find((c) => c.firmId === firmId && sameName(c.name, name));
}

// Turns the accepted proposals from the sample note into records.
function applyExtraction(
  state: State,
  firmId: string,
  note: string,
  accepted: ProposalKind[],
  extraction?: Extraction,
  acceptedIds?: string[],
  draft?: Draft
): State {
  const has = (k: ProposalKind) => accepted.includes(k);
  const contacts = [...state.contacts];
  const tasks = [...state.tasks];
  const drafts = [...state.drafts];

  if (extraction) {
  const referrer = extraction.contact;
  const existingReferrer = findContact(contacts, referrer.name, firmId);
  const referrerId = existingReferrer?.id ?? `contact-${crypto.randomUUID()}`;

  if (has("new_contact") && existingReferrer) {
    // Same person at the same firm: log this chat on their record instead of adding a duplicate.
    const index = contacts.indexOf(existingReferrer);
    contacts[index] = {
      ...existingReferrer,
      notes: existingReferrer.notes ? `${existingReferrer.notes}\n\n${note}` : note,
      timeline: has("log_chat")
        ? [{ date: extraction.chatDate, text: "Coffee chat. Notes saved." }, ...existingReferrer.timeline]
        : existingReferrer.timeline,
    };
  } else if (has("new_contact")) {
    contacts.push({
      id: referrerId,
      name: referrer.name,
      title: referrer.title ?? "",
      firmId,
      group: referrer.group ?? "",
      city: referrer.city ?? "",
      stage: "chatted",
      notes: note,
      timeline: has("log_chat")
        ? [{ date: extraction.chatDate, text: "Coffee chat. Notes saved." }]
        : [],
      status: "Chatted",
    });
  }

  if (has("new_lead")) {
    for (const [index, referral] of extraction.referrals.entries()) {
      if (
        acceptedIds &&
        !acceptedIds.includes(`referral-${index}`)
      ) {
        continue;
      }
      const referralFirm = referral.firmText?.trim();
      const matchedFirm = referralFirm ? resolveFirm(referralFirm) : null;
      const referralFirmId = matchedFirm?.kind === "match" ? matchedFirm.firm.id : "";
      if (findContact(contacts, referral.name, referralFirmId)) {
        continue;
      }
      const referralId = `contact-${crypto.randomUUID()}`;

      contacts.push({
        id: referralId,
        name: referral.name,
        title: referral.title ?? "",
        firmId: referralFirmId,
        group: referral.group ?? "",
        city: referral.city ?? "",
        stage: "to_reach",
        referredBy: has("new_contact") ? referrerId : undefined,
        notes: "",
        timeline: [
          {
            date: TODAY,
            text: `${referrer.name} suggested reaching out`,
          },
        ],
        status: `Referred by ${referrer.name}`,
      });

      tasks.push({
        id: `task-${crypto.randomUUID()}`,
        contactId: referralId,
        kind: "reach_out",
        due: addDays(TODAY, 1),
        label: `Reach out to ${referral.name}`,
      });
    }
  }

  if (has("new_contact") && has("draft") && draft) {
  // The newest draft replaces an older one, and an open thank-you task isn't stacked.
  const oldDraft = drafts.findIndex((d) => d.contactId === referrerId);
  if (oldDraft !== -1) drafts.splice(oldDraft, 1);
  drafts.push({
    ...draft,
    contactId: referrerId,
  });

  if (!tasks.some((t) => t.contactId === referrerId && t.kind === "thank_you")) tasks.push({
    id: `task-${crypto.randomUUID()}`,
    contactId: referrerId,
    kind: "thank_you",
    due: TODAY,
    label: `Thank-you to ${referrer.name}`,
  });
}

if (
  has("new_contact") &&
  has("follow_up") &&
  extraction.followUp
) {
  const oldFollowUp = tasks.findIndex((t) => t.contactId === referrerId && t.kind === "follow_up");
  if (oldFollowUp !== -1) tasks.splice(oldFollowUp, 1);
  tasks.push({
    id: `task-${crypto.randomUUID()}`,
    contactId: referrerId,
    kind: "follow_up",
    due: addDays(
      extraction.chatDate,
      extraction.followUp.afterDays
    ),
    label: `Follow up with ${referrer.name}`,
  });
}

  return { ...state, contacts, tasks, drafts };
}

  if (has("new_contact")) {
    contacts.push({
      id: "chris",
      name: "Chris",
      title: "Analyst (1st yr)",
      firmId,
      group: "FIG",
      city: "New York",
      stage: "chatted",
      notes: note,
      timeline: has("log_chat") ? [{ date: TODAY, text: "Coffee chat. Notes saved." }] : [],
      status: has("draft") ? "Thank-you not sent" : "Chatted",
      urgent: has("draft"),
    });
    if (has("draft")) {
      tasks.push({ id: "t-chris-ty", contactId: "chris", kind: "thank_you", due: TODAY, label: "Thank-you to Chris" });
      drafts.push({
        contactId: "chris",
        greetingName: "Chris",
        paragraphs: [
          "Thanks for taking the time to chat today. I really enjoyed our conversation about the group.",
          "I'll reach out to Dana as you suggested, and I'll follow up with you in a few weeks.",
        ],
        claims: [
          { text: "our conversation about the group", evidence: "good convo about the group" },
          { text: "reach out to Dana", evidence: "email his associate Dana" },
          { text: "follow up with you in a few weeks", evidence: "follow up in 3 wks" },
        ],
        signoff: "Best,",
        removed: [],
      });
    }
    if (has("follow_up")) tasks.push({ id: "t-chris-fu", contactId: "chris", kind: "follow_up", due: "2026-11-11", label: "Check in with Chris" });
  }
  if (has("new_lead")) {
    contacts.push({
      id: "dana",
      name: "Dana",
      title: "Associate",
      firmId,
      group: "FIG",
      city: "New York",
      stage: "to_reach",
      referredBy: has("new_contact") ? "chris" : undefined,
      notes: "",
      timeline: [{ date: TODAY, text: "Chris suggested reaching out" }],
      status: "Referred by Chris",
    });
    tasks.push({ id: "t-dana", contactId: "dana", kind: "reach_out", due: addDays(TODAY, 1), label: "Reach out to Dana" });
  }
  return { ...state, contacts, tasks, drafts };
}

const StoreContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    firms: FIRMS,
    contacts: CONTACTS,
    tasks: TASKS,
    drafts: DRAFTS,
    senderName: "",
  });
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useFirm(firmId: string | undefined): Firm | undefined {
  const { state } = useStore();
  return state.firms.find((f) => f.id === firmId);
}
