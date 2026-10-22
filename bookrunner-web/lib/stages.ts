import type { Stage } from "./types";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "to_reach", label: "To reach" },
  { id: "emailed", label: "Emailed" },
  { id: "chat_booked", label: "Chat booked" },
  { id: "chatted", label: "Chatted" },
  { id: "referral", label: "Referral" },
];
