"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFirm, useStore } from "@/lib/store";

const QUESTIONS = [
  "How did you end up choosing your group?",
  "What does a normal week look like for an analyst there?",
  "What do you wish you had known when you were recruiting?",
  "Is there anyone else you think I should talk to?",
];

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CallPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useStore();
  const contact = state.contacts.find((c) => c.id === id);
  const firm = useFirm(contact?.firmId);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!contact) {
    return (
      <div className="call" style={{ padding: 32 }}>
        <p>Contact not found. <Link href="/today">Back to Today</Link></p>
      </div>
    );
  }

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const end = () => router.push(`/capture?note=${encodeURIComponent(notes)}`);

  return (
    <div className="call">
      <header className="call-head">
        <Link href={`/contacts/${contact.id}`} className="small" style={{ textDecoration: "none" }}>← Leave call mode</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span className="call-timer" aria-label="Time elapsed">{clock(seconds)}</span>
          <span className="small muted">of 30 min</span>
        </div>
        <button className="btn btn-light" onClick={end}>End call and sort notes</button>
      </header>

      <div className="call-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>{contact.name}</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>{contact.title} · {firm?.name} · {contact.group}</p>
          </div>
          <section className="call-panel" aria-label="Brief">
            <h2 className="section-label">Brief</h2>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{contact.notes || "No profile pasted yet."}</p>
            <span className="small muted">Only facts from text you pasted. Nothing is looked up or guessed.</span>
          </section>
          <section aria-label="Questions">
            <h2 className="section-label" style={{ marginBottom: 4 }}>Questions</h2>
            {QUESTIONS.map((q, i) => (
              <label key={i} className={`q${done.has(i) ? " done" : ""}`}>
                <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />
                <span>{q}</span>
              </label>
            ))}
          </section>
        </div>

        <section aria-label="Quick notes" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="call-notes" className="section-label">Quick notes</label>
          <textarea
            id="call-notes"
            className="call-notes"
            placeholder="Type as you go. Shorthand is fine, it gets sorted after the call."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>
      </div>
    </div>
  );
}
