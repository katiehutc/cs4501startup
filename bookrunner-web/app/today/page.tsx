"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { addDays, daysBetween, formatLong, formatShort, TODAY } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";

const ACTION: Record<Task["kind"], string> = {
  thank_you: "Open draft",
  chat: "Prep",
  reach_out: "Open",
  follow_up: "Open",
};

function late(due: string): string {
  const days = daysBetween(due, TODAY);
  return `${days} day${days === 1 ? "" : "s"} late`;
}

export default function TodayPage() {
  const { state, dispatch } = useStore();
  const firmName = (contactId: string) => {
    const c = state.contacts.find((x) => x.id === contactId);
    const f = state.firms.find((x) => x.id === c?.firmId);
    return c ? `${f?.name ?? ""} · ${c.group} · ${c.title}` : "";
  };

  const sorted = [...state.tasks].sort((a, b) => a.due.localeCompare(b.due));
  const weekEnd = addDays(TODAY, 7);
  const groups = [
    { key: "overdue", label: "Overdue", tasks: sorted.filter((t) => t.due < TODAY) },
    { key: "today", label: "Today", tasks: sorted.filter((t) => t.due === TODAY) },
    { key: "week", label: "This week", tasks: sorted.filter((t) => t.due > TODAY && t.due <= weekEnd) },
  ];
  const owed = groups[0].tasks.length + groups[1].tasks.length;

  const nextChat = sorted.find((t) => t.kind === "chat" && t.due >= TODAY);
  const nextChatContact = state.contacts.find((c) => c.id === nextChat?.contactId);

  const stats = [
    { label: "Contacts", value: state.contacts.length },
    { label: "Banks covered", value: new Set(state.contacts.map((c) => c.firmId)).size },
    { label: "Waiting on a reply", value: state.contacts.filter((c) => c.stage === "emailed").length },
    { label: "Referrals", value: state.contacts.filter((c) => c.stage === "referral").length },
  ];

  const href = (t: Task) => (t.kind === "chat" ? `/call/${t.contactId}` : `/contacts/${t.contactId}`);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <div className="eyebrow">{formatLong(TODAY).toUpperCase()}</div>
          <h1 className="page-title">{owed === 0 ? "You're all caught up" : `You owe ${owed} thing${owed === 1 ? "" : "s"} today`}</h1>
        </div>
        <Link href="/capture" className="btn btn-primary">Paste call notes</Link>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className="stat">
            <div className="stat-num">{s.value}</div>
            <div className="small muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="today-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {groups.map((g) => (
            <section key={g.key} className="task-group" aria-label={g.label}>
              <h2 className={`section-label${g.key === "overdue" ? " warn" : ""}`}>{g.label}</h2>
              {g.tasks.length === 0 ? (
                <div className="empty small">Nothing here.</div>
              ) : (
                g.tasks.map((t) => (
                  <article key={t.id} className={`task${g.key === "overdue" ? " overdue" : ""}`}>
                    <div className="task-main">
                      <span className="task-title">{t.label}</span>
                      <span className="small muted">
                        {firmName(t.contactId)}
                        {t.time ? ` · ${t.time}` : ""}
                        {g.key === "overdue" ? ` · ${late(t.due)}` : ""}
                        {g.key === "week" ? ` · ${formatShort(t.due)}` : ""}
                      </span>
                    </div>
                    <div className="task-actions">
                      <Link href={href(t)} className="btn btn-sm">{ACTION[t.kind]}</Link>
                      <button className="btn btn-sm" onClick={() => dispatch({ type: "snooze_task", id: t.id })}>Snooze</button>
                      <button className="btn btn-sm" onClick={() => dispatch({ type: "complete_task", id: t.id })} aria-label={`Mark "${t.label}" done`}>Done</button>
                    </div>
                  </article>
                ))
              )}
            </section>
          ))}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {nextChat && nextChatContact ? (
            <section className="card" style={{ background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" }} aria-label="Next chat">
              <div className="eyebrow" style={{ color: "#c9ced8" }}>NEXT CHAT · {nextChat.due === TODAY ? "TODAY" : formatShort(nextChat.due).toUpperCase()} {nextChat.time}</div>
              <h2 style={{ margin: "8px 0 4px", fontSize: 18 }}>{nextChatContact.name}</h2>
              <p className="small" style={{ margin: "0 0 14px", color: "#c9ced8" }}>{firmName(nextChatContact.id)}</p>
              <Link href={`/call/${nextChatContact.id}`} className="btn btn-light" style={{ width: "100%" }}>Open call mode</Link>
            </section>
          ) : null}
          <section className="card" aria-label="How it works">
            <h2 className="card-title">After every call</h2>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Paste your notes. We turn them into contacts, follow-ups and a thank-you draft, and you approve each one before anything is saved.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
