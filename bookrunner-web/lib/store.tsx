"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import { addDays, TODAY } from "./dates";
import { CONTACTS, DRAFTS, FIRMS, TASKS } from "./mock-data";
import type { Contact, Draft, Firm, ProposalKind, Stage, Task } from "./types";

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
  | { type: "apply_extraction"; firmId: string; note: string; accepted: ProposalKind[] };

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
      return applyExtraction(state, action.firmId, action.note, action.accepted);
  }
}

// Turns the accepted proposals from the sample note into records.
function applyExtraction(state: State, firmId: string, note: string, accepted: ProposalKind[]): State {
  const has = (k: ProposalKind) => accepted.includes(k);
  const contacts = [...state.contacts];
  const tasks = [...state.tasks];
  const drafts = [...state.drafts];

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
