# HoosGoing: AI-Powered UVA & Charlottesville Events App

## Project Overview

HoosGoing is a social events app for University of Virginia students that also covers the wider Charlottesville community. Anyone with a UVA email can post an event, and anyone can browse a single, filterable feed of what is happening on Grounds and around town: club meetings, volunteering shifts, free food and free stuff, bar and venue nights, the farmers market, morning runs, thrift pop-ups, and more.

The core idea is that **people should not have to fill out a long form to post an event.** Event information today lives in messy places: flyer images, Instagram captions, GroupMe messages, listserv emails. A poster uploads a flyer, pastes a description, or shares a schedule, and an LLM turns it into a clean, structured event (title, date and time, location, cost, requirements, category, recurrence). Every extracted event passes through a validator before anyone sees it, and validation failures are fed back to the LLM so it can correct itself.

**Content sections (categories):**

- **Volunteering:** service shifts, drives, community projects
- **Free stuff:** free food, giveaways, free tickets
- **Club meetings:** public by default; clubs can mark meetings as members-only, visible after joining the club page
- **Charlottesville:** town events open to students and locals
- **Bars and venues:** verified business accounts can post specials and nights
- **Recurring and pop-ups:** farmers market, weekly runs, thrift pop-ups, with recurrence handled automatically

## How This Improves and Narrows Wildfire (YC S17)

Wildfire started as a campus safety alert app and grew into a social news app that let people quickly spread the word about notable things happening nearby. It also covered events, tips, and general chatter. It showed that college students want a real-time, hyper-local, campus-only feed. Grounds Pulse keeps that insight and changes three things.

| | Wildfire | Grounds Pulse |
|---|---|---|
| **Scope** | Broad social news: safety alerts, events, tips, chatter | One content type: events |
| **Content creation** | Users write short posts by hand | Users upload or paste raw material; an LLM structures it |
| **Quality control** | Mostly social and community moderation | Every LLM output is validated, with automatic retry on failure; posters are trust-tiered |
| **Geography** | Many campuses, one generic feed | One campus plus its surrounding town (UVA + Charlottesville) |
| **Structure** | Free-form posts | Structured fields: time, place, cost, requirements, category, recurrence |

Narrowing to one content type and one community lets us do something Wildfire could not: make every post searchable, filterable, and reliable, because each one is a validated structured record rather than free text.

## 1. Solves One Problem Extremely Well

**The problem:** finding out what is happening, and posting about it, is scattered and tedious. Students miss events they would have loved because information is spread across flyers, Instagram, GroupMe, and listservs. Organizers, especially small clubs, local vendors, and bars, have no single easy place to post.

**Our one job:** turn messy event information from anywhere into one trustworthy, searchable UVA and Charlottesville event feed, with near-zero effort for the poster. We are deliberately not building a general social network, a ticketing platform, or a messaging app.

## 2. Target Customers and Access

**Primary users:**

- UVA undergraduate and graduate students looking for things to do
- Organizers: club officers, volunteer coordinators, Greek life, student groups
- Local posters: bars on Grounds, the farmers market, thrift pop-up organizers, run clubs

The author is a UVA student with direct access to all of these groups.

**Validation plan:**

- Short interviews or surveys with roughly 15-20 students and 5-8 organizers about how they currently find and promote events
- A pilot with a handful of clubs and one or two local venues
- A test using real flyers and posts from the past few weeks to measure extraction accuracy

## 3. Familiarity with the Infrastructure

All components are standard and well documented:

- **Frontend:** Next.js / React (mobile-friendly web app, installable as a PWA)
- **Backend and database:** Supabase (Postgres, auth, storage) or a small Node/Python API with Postgres
- **Auth:** email login restricted to the `virginia.edu` domain for posting and commenting; browsing can stay public
- **LLM:** Claude API with structured (JSON) output; vision input for flyer images
- **Validation:** JSON Schema / Pydantic (or Zod) plus custom rule checks, described below
- **Maps and geocoding:** Mapbox or Google Maps, plus a hand-built gazetteer of UVA buildings and common Charlottesville venues
- **Scheduling:** a cron job for recurring events and reminders

## 4. Reimagining the Problem Space

The traditional approach is a form-based event calendar: the organizer fills in many fields, and most people never bother. We flip that. **The input is whatever the organizer already has** (a flyer, a caption, a GroupMe message, a semester schedule), and the system does the structuring. That removes the posting barrier, which is the main reason existing campus calendars are incomplete. Because every event is structured data, we get features that free-form feeds cannot offer:

- Filter by category, free or paid, date, and distance
- "Free dinner this week near Grounds"-style natural-language search
- Automatic handling of recurring events (weekly runs, weekly markets)
- Duplicate detection when the same event is posted by several people
- Club-aware visibility: public meetings versus members-only meetings

## 5. The LLM Is Core to the Solution

There is no chatbot sidebar. The LLM sits in the main workflow, in four places:

1. **Event extraction (core).** Raw text or a flyer image becomes a structured event record: title, start and end time, location, cost, requirements (RSVP, tickets, UVA ID, age), category, organizer, recurrence rule, and a short evidence quote from the source for each key field. A pasted semester schedule becomes many events at once.
2. **Submission risk assessment.** The LLM reads the submission and produces a structured risk assessment (is this a plausible event, does the flyer match the description, are there spam or scam signals). This is a signal for routing, not a final verdict (see the verification section).
3. **Natural-language search.** A query like "free food tonight" is translated by the LLM into a structured filter that runs against the database. The LLM never invents events; it only produces a query.
4. **Duplicate and category judgment.** The LLM helps decide whether two posts describe the same event and which category an event belongs to, using validated records.

Without the LLM, the product reverts to a standard form-based calendar. The LLM is what makes posting effortless.

## 6. Validation Guardrail

No LLM-generated artifact reaches a user without passing through a validator. Each type of output has its own checks.

**Event extraction validator:**

- **Schema check:** valid JSON, all required fields present, correct types, category from the allowed list
- **Date and time sanity:** end is after start; the date is not in the past; the date is within a reasonable window; times are interpreted in `America/New_York`; relative dates ("this Friday") resolve against the post date
- **Location check:** the location resolves to a known UVA building, a gazetteer entry, or a geocodable Charlottesville address
- **Grounding check:** every extracted field must be supported by the source. Each field carries an evidence quote, and the validator confirms the quote actually appears in the source text. Fields without support are rejected, which blocks hallucinated details
- **Recurrence check:** the recurrence rule is parsed by a real library (for example, `dateutil.rrule`) and its next occurrences are compared against the source text
- **Safety and moderation check:** flags spam, hate, personal information, and off-topic posts

**Risk assessment validator:** the risk output must match a fixed schema (a score, a list of reasons, each tied to something in the submission). The routing decision itself is made by deterministic rules from that output, not by free-form LLM text.

**Search validator:** the structured filter from a natural-language query is validated against the filter schema before it is run. Results come only from the database.

**Comment validator (if comments are included):** an LLM-based moderation check plus rule-based filters run before a comment is published.

## 7. Self-Correction Loop

When the validator rejects an extraction, the errors are returned to the LLM automatically, with no user involvement:

1. The LLM produces a candidate event.
2. The validator returns a structured list of errors, for example: `end_time is before start_time`, `location "the lawn thing" could not be resolved`, `evidence quote for cost not found in source`.
3. The original input, the previous attempt, and the error list are sent back to the LLM with an instruction to fix only the failing fields.
4. The corrected output is re-validated. This repeats for up to three attempts.
5. If it still fails, the system does not publish a bad event. It shows the poster a pre-filled edit form with the validated fields and highlights the ones that need attention.

Every retry is logged so the final writeup can report how often the loop fixes errors, which error types are most common, and overall accuracy against a hand-labeled test set of real UVA flyers and posts.

## 8. Deployability

The app can be fully deployed on free or low-cost tiers:

- **Hosting:** Vercel for the web app; Supabase for database, auth, and file storage
- **LLM cost:** low, since each submission is one short call (plus occasional retries); per-user rate limits keep costs bounded
- **Privacy and safety:** only public event information is stored; posting requires a `virginia.edu` email; no scraping of private groups. The MVP uses paste, upload, and share-to-app rather than automated scraping, which avoids terms-of-service problems
- **Reliability:** failed extractions fall back to the manual form, so the app never blocks posting

**Stretch goals:** personalized ranking, push notifications, verified business accounts for bars and venues, a "going" count with friends.

## Poster Verification and Trust

**Goal:** keep fake or spammy events out of the feed without making posting slow.

**Design decisions:**

- **No UVA ID numbers.** Students should not be asked to type student ID numbers into a class project: it is sensitive personal data and creates a security and privacy liability. Identity is established by logging in with a `virginia.edu` email (magic link or Google/SSO). The computing ID in the email address is enough to show the poster is affiliated with UVA.
- **The LLM scores risk; it does not decide truth.** An LLM cannot know whether an event is real. It can judge whether a submission is internally consistent and plausible: the flyer matches the description, the date and place make sense, and there are no scam or spam signals. That output is a risk score with reasons, validated against a schema (see Section 6).
- **Human review is reserved for the risky cases.** Reviewing every post by hand does not scale.

**Trust tiers:**

| Tier | Who | What happens |
|---|---|---|
| New poster | First submission from a `virginia.edu` email | Extraction and validation run. Low risk: publishes immediately. Elevated risk: goes to the review queue |
| Trusted poster | Several approved posts, no reports | Auto-publishes if it passes validation |
| Verified organization | Club or business with an officer affiliation checked once by a human (for example, a listing on the club's official page or an email from an organizer) | Verified badge, auto-publishes, can set members-only events and club pages |
| Flagged | Reported by users or repeatedly rejected | All posts go to the review queue |

**Routing rules (deterministic, not LLM-decided):**

1. Fails validation after three retries: back to the poster with an edit form.
2. Passes validation and low risk score: publish.
3. Passes validation and elevated risk score, or the poster is new and the event is paid, off-campus, or mentions money or links: review queue.
4. Moderation flags (hate, personal information, explicit content): block and send to the review queue.

**Human review queue:** a simple admin page showing the original submission, the extracted event, the risk reasons, and Approve / Edit / Reject buttons. Because only flagged posts arrive here, a few reviewers can handle it. Every decision is stored and can feed the evaluation (how often the risk score agrees with the human).

**Community signal:** a report button on every event. A few reports from different users automatically hide the event pending review and move the poster to the Flagged tier.

## Open Design Question: Comments

Comments can create moderation problems. Recommended approach for the MVP: limit comments to event-specific questions and answers ("Is there parking?"), require a `virginia.edu` login, run every comment through the moderation validator, and include a report button. If moderation proves too costly or risky, comments can be removed without affecting the core product.
