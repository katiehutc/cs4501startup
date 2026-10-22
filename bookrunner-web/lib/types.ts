export type Stage = "to_reach" | "emailed" | "chat_booked" | "chatted" | "referral";

export type Tier = "Bulge bracket" | "Elite boutique" | "Middle market";

export interface Firm {
  id: string;
  name: string;
  tier: Tier;
  // Shorthand students use in notes, e.g. "GS". Used to resolve firm names.
  aliases: string[];
}

export interface TimelineEvent {
  date: string; // YYYY-MM-DD
  text: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  firmId: string;
  group: string;
  city: string;
  stage: Stage;
  referredBy?: string; // contact id
  notes: string; // the student's own notes, used for grounding checks
  timeline: TimelineEvent[];
  status?: string; // short line shown on board cards
  urgent?: boolean;
}

export type TaskKind = "thank_you" | "follow_up" | "reach_out" | "chat";

export interface Task {
  id: string;
  contactId: string;
  kind: TaskKind;
  due: string; // YYYY-MM-DD
  time?: string;
  label: string;
}

export interface Claim {
  text: string; // the phrase as it appears in the draft
  evidence: string; // the words from the student's notes that support it
}

export interface Draft {
  contactId: string;
  greetingName: string;
  paragraphs: string[];
  claims: Claim[];
  signoff: string;
  removed: string[]; // claims the validator dropped on an earlier attempt
}

export type ProposalKind = "new_contact" | "log_chat" | "new_lead" | "follow_up" | "draft";

export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  detail?: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: { label: string; value: string }[];
}

export interface ExtractionResult {
  questions: Question[];
  proposals: Proposal[];
}
