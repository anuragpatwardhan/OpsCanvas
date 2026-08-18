# OpsCanvas

An engineering operations dashboard. It pulls activity from GitHub, Jira and Slack,
stitches it into one timeline per piece of work, and surfaces the things that are
quietly going wrong — a PR nobody has reviewed in four days, a ticket that has been
blocked all week, an incident with no follow-up ticket.

The point is not another activity feed. It is answering "what needs attention right
now, and why" without a human reading three tools.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Vitest.

## How it works

```
connectors  →  normalize  →  signal engine  →  snapshot engine  →  UI
```

**Connectors** (`lib/connectors/`) each expose the same interface and translate their
source's payloads into a single `NormalizedEvent` shape: id, source, type, project,
timestamp, actor, refs and payload. Because everything downstream reads that one type,
adding a fourth source means writing one connector and touching nothing else.

A **mock connector** runs whenever no real credentials are configured, so the dashboard
is fully explorable without wiring up three OAuth apps.

**The signal engine** (`lib/signalEngine.ts`) turns events into human-readable concerns.
Each rule escalates with age rather than firing a single flat alert:

| Signal | Fires when |
| --- | --- |
| Review backlog | a PR has been open past the threshold with no review |
| Churn risk | a PR has been reopened repeatedly |
| Stale ticket | a ticket has sat untouched too long |
| Blocked ticket | a ticket has been blocked for several days |
| Unlinked incident | a Slack incident thread has no follow-up ticket |

**The snapshot engine** (`lib/snapshotEngine.ts`) rolls signals and events into what the
UI renders:

- `computeSnapshots` — per-project health (`stable` / `watch` / `risk`), trend, the most
  severe reason, and counts of open PRs, stale tickets and active incidents. Health is
  the worst severity present; trend compares the last two days against the two before.
- `computeTeamLoad` — per-person active threads, pending reviews and incidents touched,
  with a `balanced` / `stretched` / `overloaded` verdict. Synthetic actors like `system`
  are dropped so bot traffic does not read as a busy human.
- `computeThreads` — groups every event sharing a ticket key into one chronological
  thread, so a ticket, its PR and its Slack discussion read as a single story.

All three are pure functions of their inputs, which is what makes them straightforward
to test.

**Acknowledgements** (`lib/acknowledgements.ts`) let a signal be muted once it has been
seen — either indefinitely or snoozed for a set number of hours.

Signals are recomputed from scratch on every ingestion cycle, so an acknowledgement
cannot live on the signal itself. It is stored separately and keyed by signal id, which
each rule derives from the underlying entity (`sig_review_<pr>`, `sig_stale_<ticket>`)
rather than generating fresh each run. That stable identity is what lets a snooze
survive a resync.

Expiries are absolute timestamps, not durations, so a snooze cannot silently extend
itself every time the datastore reloads — and a lapsed one simply stops matching, with
no cleanup job needed for the signal to reappear. Each ingestion cycle prunes
acknowledgements that have expired or whose signal has stopped firing, so the store does
not grow as PRs and tickets come and go.

| Endpoint | Does |
| --- | --- |
| `POST /api/signals/:id/ack` | mute a signal; `{"hours": 4}` to snooze, empty body for indefinite |
| `DELETE /api/signals/:id/ack` | bring it back |
| `GET /api/signals?acknowledged=include` | include muted signals, flagged rather than hidden |

Snoozes are capped at 30 days, so a real problem cannot be buried for years.

## Data

State lives in a JSON file under `data/`, written by `lib/store.ts`. That keeps the
project runnable with no database — clone, install, run. The directory is generated and
gitignored; delete it to reset.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first load the app bootstraps itself with mock data.

To connect real sources, copy `.env.example` to `.env.local` and fill in whichever you
have. Any connector without credentials simply stays inactive:

| Source | Needs |
| --- | --- |
| GitHub | `GITHUB_TOKEN` — a classic PAT with `repo` scope |
| Jira | `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |
| Slack | `SLACK_BOT_TOKEN` — with `channels:history` and `channels:read` |

## Tests

```bash
npm test
```

168 cases:

- **Signal engine** — rule thresholds and, just as importantly, the conditions that must
  *not* fire.
- **Snapshot engine** — health and trend derivation, the review-backlog fallback, team
  load banding, and thread grouping and ordering.
- **Connectors** — the rule that mock data never mixes with real data, which credentials
  each source requires, GitHub payload normalisation including ticket-key extraction from
  a title or branch, and that one failing repository never costs another its events.
- **Jira connector** — one issue producing a creation event and, only when it has actually
  moved, a separate status change; the reporter credited for creation and the assignee for
  the update; an unassigned ticket falling back to `unknown` rather than inventing a
  person; and distinct event ids, since a collision would make `appendMany` drop one.
- **Acknowledgements** — expiry boundaries, a snoozed signal returning once its window
  lapses, pruning of stale entries, and that an acknowledgement for a signal that is no
  longer firing is ignored.
- **Ack endpoints** — duration validation and the 30-day cap, re-acknowledging replacing
  rather than stacking, 404s for unknown signals, and that a rejected request never
  writes to disk.

- **Slack connector** — mainly what it *refuses* to emit, since a false incident drags a
  project's health to risk: an unthreaded remark about an outage is chatter, and a thread
  with no incident wording is not an incident. Plus epoch-to-ISO conversion, the `unknown`
  actor fallback for bot messages, Slack's application-level `ok: false` (which arrives
  over HTTP 200), and the channel hash being stripped rather than URL-encoded.
- **Store** — the migration path where a datastore written before a field existed still
  loads, a corrupt file falling back to empty rather than crashing, `appendMany`
  de-duplicating by id so re-fetched windows do not double the counts, and that signals,
  snapshots and threads are wholesale replacements rather than merges.

Connector tests re-import the module with the environment already set, because each
connector reads its credentials into a module-level constant at import time.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build and serve |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run seed` | reseed the local datastore |

Type checking runs through `npx tsc --noEmit`. There is no ESLint configuration yet, so
`npm run lint` will offer to create one rather than lint anything.

## Layout

```
app/           routes and API handlers
components/    dashboard UI
lib/
  connectors/  one module per source, plus the mock
  signalEngine.ts    events  → signals
  snapshotEngine.ts  signals → project, team and thread views
  ingestion.ts       the sync cycle
  store.ts           JSON-file persistence
  __tests__/         engine tests
```
