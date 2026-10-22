"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { extractFromNotes, SAMPLE_NOTE } from "@/lib/extract";
import { useStore } from "@/lib/store";
import type { ExtractionResult, ProposalKind } from "@/lib/types";

const KIND_LABEL: Record<ProposalKind, string> = {
  new_contact: "NEW CONTACT",
  log_chat: "LOG CHAT",
  new_lead: "NEW LEAD",
  follow_up: "FOLLOW-UP",
  draft: "THANK-YOU DRAFT",
};

function Capture() {
  const params = useSearchParams();
  const { dispatch } = useStore();
  const [note, setNote] = useState(params.get("note") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setAnswers({});
    setUnchecked(new Set());
    try {
      setResult(await extractFromNotes(note));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const unanswered = result?.questions.filter((q) => !answers[q.id]) ?? [];
  const accepted = result?.proposals.filter((p) => !unchecked.has(p.id)) ?? [];

  const save = () => {
    if (!result) return;
    dispatch({ type: "apply_extraction", firmId: answers.firm, note, accepted: accepted.map((p) => p.kind) });
    setSaved(true);
  };

  return (
    <AppShell>
      <div className="page-head">
        <h1 className="page-title">Paste notes</h1>
      </div>

      <div className="capture-grid">
        <section className="card" aria-label="Your notes" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="note" className="card-title" style={{ margin: 0 }}>What happened?</label>
          <textarea
            id="note"
            className="note-input"
            placeholder="Paste call notes, an email thread or a LinkedIn profile"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setNote(SAMPLE_NOTE)}>Use the sample note</button>
            <button className="btn btn-primary" disabled={!note.trim() || loading} onClick={run}>
              {loading ? "Reading your notes…" : "Sort it out"}
            </button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Nothing is saved until you approve it.</p>
        </section>

        <section aria-label="Proposed updates" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {error ? <div className="error" role="alert">{error}</div> : null}

          {!result && !error ? (
            <div className="empty">Proposed updates will show up here for you to review.</div>
          ) : null}

          {result && saved ? (
            <div className="success" role="status">
              Saved {accepted.length} update{accepted.length === 1 ? "" : "s"}.{" "}
              <Link href="/today">See Today</Link>
              {accepted.some((p) => p.kind === "new_contact") ? (
                <> or <Link href="/contacts/chris">open Chris</Link></>
              ) : null}
              .
            </div>
          ) : null}

          {result && !saved ? (
            <>
              {result.questions.map((q) => (
                <div key={q.id} className="question" role="group" aria-label={q.prompt}>
                  <span className="question-prompt">{q.prompt}</span>
                  <div className="chips">
                    {q.options.map((o) => (
                      <button
                        key={o.value}
                        className={`chip${answers[q.id] === o.value ? " on" : ""}`}
                        aria-pressed={answers[q.id] === o.value}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <ul className="proposals">
                {result.proposals.map((p) => (
                  <li key={p.id}>
                    <label className="proposal">
                      <input type="checkbox" checked={!unchecked.has(p.id)} onChange={() => toggle(p.id)} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span className="proposal-kind">{KIND_LABEL[p.kind]}</span>
                        <span style={{ fontWeight: 600 }}>{p.title}</span>
                        {p.detail ? <span className="small muted">{p.detail}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <button className="btn btn-primary" style={{ height: 48 }} disabled={unanswered.length > 0 || accepted.length === 0} onClick={save}>
                {unanswered.length > 0 ? "Answer the question above first" : `Save ${accepted.length} update${accepted.length === 1 ? "" : "s"}`}
              </button>
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

export default function CapturePage() {
  return (
    <Suspense>
      <Capture />
    </Suspense>
  );
}
