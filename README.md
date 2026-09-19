# OBRA

An experimental workspace for building with typed AI decisions using [TypeSafe](https://typesafe.ai/).

OBRA brings together three bilingual tools:

- **Government services search:** finds official routes for Boston, Massachusetts, and federal services.
- **Proposal reviewer:** analyzes PDF, DOCX, and TXT documents before a commercial proposal is sent.
- **Personal agenda:** turns text or voice into events, organizes daily plans, and lets users update them conversationally.

> This is an experimental project. It does not provide legal advice, determine eligibility for government services, or automatically book real appointments.

## How TypeSafe is used

The application keeps interpretation and execution separate:

1. TypeSafe classifies intent, relevance, priority, effort, and potential risks.
2. Application code applies deterministic rules for dates, times, conflicts, and confidence thresholds.
3. The user reviews the result before any change is saved.

TypeSafe does not generate government requirements. That information lives in a curated catalog with official links and verification dates.

## Features

### Government services

- Natural-language search in English and Spanish.
- Multiple matches with probabilities.
- Conservative states for ambiguous requests.
- Official sources, responsible authorities, and verification dates.
- A catalog of municipal, state, and federal services.

### Commercial proposals

- Automatic PDF, DOCX, and TXT document analysis.
- Files up to 25 MB and 90,000 extracted characters.
- A concise document summary.
- Separate coverage and risk checks for scope, pricing, timelines, and non-standard commitments.
- Automatic cancellation of the previous request when a new document is selected.
- In-memory processing with no application-level document persistence.

### Personal agenda

- Text input and browser-based speech recognition.
- Live interpretation while the user speaks.
- Event creation, modification, and deletion.
- Multi-task plans with low, medium, or high priority.
- Conversational editing before a plan is saved.
- Detection of ambiguous times, duration, and scheduling conflicts.
- Prefilled Google Calendar links.
- Local persistence through `localStorage`.

## Tech stack

- Next.js 15 and React 19
- TypeScript
- Tailwind CSS 4
- TypeSafe JavaScript SDK
- `pdf-parse` and `mammoth` for document extraction
- Web Speech API for voice input

## Run locally

Requirements: Node.js 20 LTS or 22 LTS and a TypeSafe API key.

```bash
npm install
cp .env.example .env.local
```

Add the key only to `.env.local`:

```bash
TYPESAFE_API_KEY=your_key
```

Then start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

When `TYPESAFE_API_KEY` is not configured, the API routes use deterministic demo fallbacks so the interface remains explorable.

## Scripts

```bash
npm run dev          # Start the development server
npm run build        # Create a production build and check types
npm run start        # Run the production build
npm run lint         # Run ESLint
npm run format       # Format the repository with Prettier
npm run format:check # Check formatting without changing files
```

## Main routes

| Route           | Description                                 |
| --------------- | ------------------------------------------- |
| `/`             | Bilingual landing page                      |
| `/services`     | Government services search                  |
| `/proposals`    | Commercial proposal reviewer                |
| `/appointments` | Personal agenda with text and voice input   |
| `/admin`        | Local review of unresolved service searches |

TypeSafe integrations run in server routes under `app/api`. The API key is never sent to the browser.

## Project structure

```text
app/
├── api/                  # Server-side integrations and fallbacks
├── appointments/         # Conversational agenda
├── components/           # Shared UI
├── lib/                  # Domain catalogs and types
├── proposals/            # Document analysis
├── services/             # Government services search
├── globals.css           # Tailwind theme and global patterns
└── page.tsx              # Landing page
```

## Privacy and security

- The TypeSafe API key is used only on the server.
- `.env.local` is excluded from Git.
- Agenda data is stored only in the user's browser.
- Documents are not written to disk or stored in a database.
- There are no accounts, payments, official form submissions, or real bookings.

Do not include sensitive information in a public demo. Before deploying to production, add rate limits, monitoring, a retention policy, and controls appropriate for your infrastructure.

## Project status

OBRA is an active prototype. Catalog content and decision thresholds should be reviewed regularly and validated against representative cases before the application is used in a production workflow.
