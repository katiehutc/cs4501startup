import type { Contact, Firm } from "./types";

// A firm the resolver couldn't match is stored as "", so pages need a readable stand-in.
export const UNKNOWN_FIRM = "Firm unknown";

// "Analyst · Goldman Sachs · FIG · New York", skipping blanks so there are no empty dots.
export function contactLine(parts: (string | Firm | undefined)[]): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : part?.name ?? UNKNOWN_FIRM))
    .filter((part) => part !== "")
    .join(" · ");
}

export function banksCovered(contacts: Pick<Contact, "firmId">[]): number {
  return new Set(contacts.map((c) => c.firmId).filter((id) => id !== "")).size;
}
