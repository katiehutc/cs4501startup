# Bookrunner

Bookrunner is a web application for organizing investment banking networking and recruiting. It helps users turn networking notes into structured contacts, follow-up tasks, and thank-you email drafts.

Instead of manually updating a tracker after every conversation, users can paste their notes into Bookrunner, review AI-generated suggestions, approve what they want to save, and manage their next steps.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **AI integration:** Anthropic SDK (Claude)
- **State management:** React Context and `useReducer`
- **Testing:** Vitest, React Testing Library, jsdom
- **Coverage:** Vitest with V8 coverage

## Getting Started

### Prerequisites

Install Node.js and npm.

### Installation

Clone the repository and navigate to the web application:

```bash
git clone https://github.com/katiehutc/cs4501startup.git
cd cs4501startup/bookrunner-web
npm ci
```

### Environment Configuration

Create a `.env.local` file inside `bookrunner-web`:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

An Anthropic API key is required for the Claude-powered extraction pipeline. Do not commit API keys or `.env.local` to GitHub.

### Run Locally

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Production Build

```bash
npm run build
npm run start
```

## Main Features

**Capture:** Paste notes from a networking conversation. Bookrunner uses an LLM pipeline to extract structured information, identify firms and contacts, generate follow-up suggestions, and prepare thank-you drafts. Users review and approve proposals before saving.

**Board:** View and organize networking contacts, including their firms, recruiting stages, and relevant follow-up information.

**Today:** See upcoming tasks grouped into Overdue, Today, and This week. Overdue tasks display how many days late they are. Users can snooze or complete tasks.

**Contact management:** View contact details, access generated drafts, and mark thank-you messages as sent.

## Testing

Run all automated tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run coverage
```

Run the TypeScript type checker:

```bash
npx tsc --noEmit
```

Run an individual test file:

```bash
npx vitest run app/today/page.test.tsx
```

Tests use Vitest and React Testing Library. Test files are colocated with the modules they test and follow the `.test.ts` or `.test.tsx` naming convention.

Tests cover functionality including firm resolution, LLM extraction, validation, proposal approval, task creation, and Today page interactions.

Coverage reports are generated in the `coverage/` directory.

## Architecture

Bookrunner separates the user interface, application state, and AI processing pipeline.

```text
User
 |
 v
Next.js / React UI (app/)
 |
 +-- Capture page
 |     |
 |     v
 |   AI extraction pipeline (lib/pipeline/)
 |     |
 |     +-- Anthropic Claude (lib/llm/)
 |     |
 |     +-- Structured extraction
 |     |
 |     +-- Firm resolution (lib/firms/)
 |     |
 |     +-- Validation and correction
 |     |
 |     v
 |   User reviews and approves proposals
 |     |
 |     v
 +-- React application store (lib/store.tsx)
 |     |
 |     +-- Contacts
 |     +-- Firms
 |     +-- Tasks
 |     +-- Drafts
 |     |
 |     +-- Board page
 |     +-- Today page
 |     +-- Contact details
 |
 v
Updated application UI
```

### Data Flow

1. The user enters networking notes on the Capture page.
2. The AI pipeline processes the notes and produces structured proposals.
3. Firm resolution and validation check the extracted information. Ambiguous information can require user clarification.
4. The user reviews and approves the proposed changes.
5. Approved information updates the application store.
6. Contacts, drafts, and follow-up tasks appear throughout the application.

The current application uses a React-based store initialized with mock data. This should not be confused with a persistent production database.

## Project Structure

```text
bookrunner-web/
├── app/
│   ├── board/             # Contact board
│   ├── capture/           # Note capture and review
│   ├── today/             # Follow-up task dashboard
│   ├── layout.tsx         # Root application layout
│   └── globals.css        # Global styles
├── components/
│   └── AppShell.tsx       # Shared application shell
├── lib/
│   ├── firms/             # Firm data and name resolution
│   ├── llm/               # Claude integration and extraction
│   ├── pipeline/          # Extraction workflow and validation
│   ├── validation/        # Structured extraction validation
│   ├── contracts.ts       # Shared extraction contracts
│   ├── dates.ts           # Date utilities
│   ├── mock-data.ts       # Initial application data
│   ├── store.tsx          # React state management
│   └── types.ts           # Shared TypeScript types
├── scripts/               # Project utility scripts
├── test/                  # Additional test resources
├── vitest.config.ts       # Test and coverage configuration
└── package.json           # Dependencies and npm scripts
```

## Team Responsibilities

| Team member | Responsibilities |
|---|---|
| Katie | Test setup, Today page, README, integration and validation tests |
| Ausdin | LLM integration and AI pipeline development |
| Sean | Project coordination, team planning, presentation and final deliverable assembly |

Team members also collaborate on testing, integration, code reviews, and pull requests. Ownership of individual modules and issues is tracked in GitHub.

## Repository

[GitHub: cs4501startup](https://github.com/katiehutc/cs4501startup)

Project issues and pull requests document feature requirements, acceptance criteria, implementation, testing, and reviews.
