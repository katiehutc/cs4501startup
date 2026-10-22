"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { formatShort } from "@/lib/dates";
import { STAGES } from "@/lib/stages";
import { useFirm, useStore } from "@/lib/store";
import type { Claim, Stage } from "@/lib/types";
import { draftText, validateDraft } from "@/lib/validate";

// Wraps each grounded claim in a <mark> so the student can see what was checked.
function highlight(paragraph: string, claims: Claim[]): ReactNode[] {
  const parts: ReactNode[] = [];
  let rest = paragraph;
  let key = 0;
  while (rest) {
    const hits = claims
      .map((c) => ({ c, i: rest.indexOf(c.text) }))
      .filter((h) => h.i >= 0)
      .sort((a, b) => a.i - b.i);
    if (hits.length === 0) {
      parts.push(rest);
      break;
    }
    const { c, i } = hits[0];
    if (i > 0) parts.push(rest.slice(0, i));
    parts.push(
      <mark key={key++} className="claim" title={`From your notes: "${c.evidence}"`}>
        {c.text}
      </mark>,
    );
    rest = rest.slice(i + c.text.length);
  }
  return parts;
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="Passed" role="img" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-label="Needs attention" role="img" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 17h.01" />
    </svg>
  );
}

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const contact = state.contacts.find((c) => c.id === id);
  const firm = useFirm(contact?.firmId);
  const [copied, setCopied] = useState(false);

  if (!contact) {
    return (
      <AppShell>
        <h1 className="page-title">Contact not found</h1>
        <Link href="/board" className="btn" style={{ alignSelf: "flex-start" }}>Back to the board</Link>
      </AppShell>
    );
  }

  const referrer = state.contacts.find((c) => c.id === contact.referredBy);
  const referred = state.contacts.filter((c) => c.referredBy === contact.id);
  const draft = state.drafts.find((d) => d.contactId === contact.id);
  const thankYouOwed = state.tasks.some((t) => t.contactId === contact.id && t.kind === "thank_you");
  const checks = draft ? validateDraft(draft, contact, state.firms, state.senderName) : [];
  const ready = checks.every((c) => c.ok);
  const body = draft ? draftText(draft, state.senderName) : "";

  const copy = async () => {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="page-head">
        <Link href="/board" className="small muted">← Firm board</Link>
      </div>

      <div className="contact-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section className="card" aria-label="Contact">
            <h1 className="page-title">{contact.name}</h1>
            <p className="muted" style={{ margin: "6px 0 12px" }}>
              {contact.title} · {firm?.name} · {contact.group} · {contact.city}
            </p>
            <div className="chips" style={{ marginBottom: 14 }}>
              {referrer ? <Link href={`/contacts/${referrer.id}`} className="tag">Referred by {referrer.name}</Link> : null}
              {referred.map((r) => (
                <Link key={r.id} href={`/contacts/${r.id}`} className="tag">Referred you to {r.name}</Link>
              ))}
            </div>
            <label className="field">
              Stage
              <select
                className="input"
                value={contact.stage}
                onChange={(e) => dispatch({ type: "set_stage", contactId: contact.id, stage: e.target.value as Stage })}
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            {contact.stage === "chat_booked" ? (
              <Link href={`/call/${contact.id}`} className="btn" style={{ marginTop: 12, width: "100%" }}>Open call mode</Link>
            ) : null}
          </section>

          <section className="card" aria-label="Your notes">
            <h2 className="card-title">Your notes</h2>
            <p className="small" style={{ margin: 0, lineHeight: 1.55, whiteSpace: "pre-line" }}>
              {contact.notes || <span className="muted">No notes yet.</span>}
            </p>
          </section>

          <section className="card" aria-label="Timeline">
            <h2 className="card-title">Timeline</h2>
            {contact.timeline.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>Nothing yet.</p>
            ) : (
              <ol className="timeline">
                {contact.timeline.map((e, i) => (
                  <li key={i}>
                    <span className="timeline-date">{formatShort(e.date).toUpperCase()}</span>
                    <span>{e.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {draft && thankYouOwed ? (
          <section className="card" aria-label="Thank-you draft" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h2 className="card-title" style={{ margin: 0 }}>Thank-you draft</h2>
              <span className="small muted">Highlighted details came from your notes</span>
            </div>

            <div className="draft-box">
              <p>Hi {draft.greetingName},</p>
              {draft.paragraphs.map((p, i) => (
                <p key={i}>{highlight(p, draft.claims)}</p>
              ))}
              <p>{`${draft.signoff}\n${state.senderName.trim() || "[Your name]"}`}</p>
            </div>

            <label className="field">
              Your name
              <input
                className="input"
                value={state.senderName}
                placeholder="Fills the [Your name] placeholder"
                onChange={(e) => dispatch({ type: "set_sender", name: e.target.value })}
              />
            </label>

            <ul className="checks" aria-label="Checks">
              {checks.map((c) => (
                <li key={c.id} className={c.ok ? "" : "fail"}>
                  <CheckIcon ok={c.ok} />
                  {c.label}
                </li>
              ))}
              {draft.removed.map((r, i) => (
                <li key={`removed-${i}`} className="muted">
                  <CheckIcon ok />
                  Removed {r}
                </li>
              ))}
            </ul>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button className="btn btn-primary" disabled={!ready} onClick={copy}>
                {copied ? "Copied" : "Copy email"}
              </button>
              <a
                className="btn"
                aria-disabled={!ready}
                style={ready ? undefined : { pointerEvents: "none", opacity: 0.5 }}
                href={`mailto:?subject=${encodeURIComponent("Thank you")}&body=${encodeURIComponent(body)}`}
              >
                Open in email app
              </a>
              <button className="btn" onClick={() => dispatch({ type: "mark_sent", contactId: contact.id })}>
                Mark as sent
              </button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Nothing is ever sent for you. You send it, then mark it as sent.</p>
          </section>
        ) : (
          <section className="card" aria-label="Next step">
            <h2 className="card-title">{contact.status === "Thank-you sent" ? "Thank-you sent" : "No draft right now"}</h2>
            <p className="small muted" style={{ margin: "0 0 14px", lineHeight: 1.5 }}>
              After your next conversation with {contact.name.split(" ")[0]}, paste your notes and a grounded draft will show up here.
            </p>
            <Link href="/capture" className="btn">Paste notes</Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
