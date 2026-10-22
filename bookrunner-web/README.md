# Bookrunner (working name): desktop front end

A networking tracker for investment banking recruiting. You paste messy notes after a coffee chat, and the app turns them into contacts, referral leads, follow-ups and a thank-you draft. You approve each item before it's saved, and every detail in a draft is checked against your notes.

This is the front end only. It runs on mock data, uses a fixed "today" of Oct 21, 2026, and keeps everything in memory, so a page reload resets it.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Screens

| Route | What it is | Wireframe |
|---|---|---|
| `/today` | What you owe today: overdue, today, this week. Snooze or mark items done. | A (FollowOn) |
| `/board` | Contacts by stage, filterable by bank type, plus a coverage-by-bank table | B (Bookrunner) |
| `/contacts/[id]` | Contact, notes, timeline, and a thank-you draft with live checks | B |
| `/capture` | Paste notes, answer clarifying questions, approve proposed updates | A |
| `/call/[id]` | Full-screen call mode: timer, brief, question checklist, quick notes | C (Superday) |

## A quick demo path

1. **Today:** open Jake's overdue thank-you.
2. **Jake's page:** type your name, and all three checks turn green.
3. **Paste notes:** click "Use the sample note", then "Sort it out". Answer the GS question and save.
4. Chris and Dana now appear on Today and on the board, and Chris has a grounded draft.

## Where the backend plugs in

- `lib/extract.ts`, `extractFromNotes()`: returns a canned result for the sample note. Replace it with a call to your API route, which should ask the LLM for structured JSON, validate it, and retry on failures.
- `lib/validate.ts`, `validateDraft()`: real deterministic checks (grounding against notes, recipient and firm match, leftover placeholders). These can move to the server unchanged and be reused as the retry loop's validator.
- `lib/mock-data.ts`: firms (with aliases like "GS"), contacts, tasks and drafts. Swap this for Supabase queries.
- `lib/brand.ts`: the app name in one place.

Stack: Next.js 15 (App Router), React 19, TypeScript, plain CSS (`app/globals.css`), IBM Plex fonts from Google Fonts.
