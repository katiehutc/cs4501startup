import type { FirmMatch } from "../contracts";
import { FIRMS } from "./data";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveFirm(text: string): FirmMatch {
  const normalized = normalize(text);

  if (!normalized) {
    return { kind: "unknown", text };
  }

  const matches = FIRMS.filter((firm) =>
    [firm.name, ...firm.aliases].some(
      (name) => normalize(name) === normalized,
    ),
  );

  if (matches.length === 1) {
    return { kind: "match", firm: matches[0] };
  }

  if (matches.length > 1) {
    return { kind: "ambiguous", options: matches };
  }

  return { kind: "unknown", text };
}
