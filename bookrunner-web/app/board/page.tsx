"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { STAGES } from "@/lib/stages";
import { useStore } from "@/lib/store";
import type { Tier } from "@/lib/types";

const TIERS: (Tier | "All banks")[] = ["All banks", "Bulge bracket", "Elite boutique", "Middle market"];

export default function BoardPage() {
  const { state } = useStore();
  const [tier, setTier] = useState<Tier | "All banks">("All banks");
  const [query, setQuery] = useState("");

  const firmOf = (id: string) => state.firms.find((f) => f.id === id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.contacts.filter((c) => {
      const firm = firmOf(c.firmId);
      if (tier !== "All banks" && firm?.tier !== tier) return false;
      if (!q) return true;
      return [c.name, c.group, c.title, firm?.name ?? ""].some((s) => s.toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.contacts, tier, query]);

  const coverage = state.firms
    .map((f) => {
      const people = visible.filter((c) => c.firmId === f.id);
      const furthest = Math.max(-1, ...people.map((c) => STAGES.findIndex((s) => s.id === c.stage)));
      return { firm: f, people, furthest };
    })
    .filter((row) => row.people.length > 0)
    .sort((a, b) => b.furthest - a.furthest);

  return (
    <AppShell>
      <div className="page-head">
        <h1 className="page-title">Firm board</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            type="search"
            className="search"
            placeholder="Search banks or people"
            aria-label="Search banks or people"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link href="/capture" className="btn btn-primary">Paste notes</Link>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter by bank type">
        {TIERS.map((t) => (
          <button key={t} className={`chip${tier === t ? " on" : ""}`} aria-pressed={tier === t} onClick={() => setTier(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="board-scroll">
        <div className="board">
          {STAGES.map((s) => {
            const people = visible.filter((c) => c.stage === s.id);
            return (
              <section key={s.id} className="column" aria-label={s.label}>
                <h2 className="column-head">
                  {s.label} · <span className="mono">{people.length}</span>
                </h2>
                {people.map((c) => (
                  <Link key={c.id} href={`/contacts/${c.id}`} className="person-card">
                    <span className="person-firm">{firmOf(c.firmId)?.name}</span>
                    <span className="person-name">{c.name} · {c.title}</span>
                    {c.status ? <span className={`person-status${c.urgent ? " urgent" : ""}`}>{c.status}</span> : null}
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      </div>

      <section className="card" aria-label="Coverage by bank">
        <h2 className="card-title">Coverage by bank</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="coverage">
            <thead>
              <tr>
                <th scope="col">Bank</th>
                <th scope="col">Type</th>
                <th scope="col">People</th>
                <th scope="col">Furthest stage</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((row) => (
                <tr key={row.firm.id}>
                  <td style={{ fontWeight: 600 }}>{row.firm.name}</td>
                  <td className="muted">{row.firm.tier}</td>
                  <td className="mono">{row.people.length}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="dots" aria-hidden="true">
                        {STAGES.map((s, i) => (
                          <span key={s.id} className={`dot${i <= row.furthest ? " on" : ""}`} />
                        ))}
                      </span>
                      <span className="small">{STAGES[row.furthest]?.label}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
