# Travel Entitlement Engine

This app determines what travel benefits a user is entitled to
(lounge access, fast track, priority boarding, etc.) based on
their flight + status cards.

## Core concepts
- We do NOT think in terms of "airline + status + airport".
- We think in terms of normalized entitlements:
  `airline → alliance`, `airline tier → alliance_tier`.
- `"alliance = null"` is a valid state (Emirates, low-cost, etc.).
- Lounges have multiple access channels (airline / alliance /
  contract / Priority Pass / paid). Same lounge can have many.
- Rules live in the DATABASE, not in code. Adding a new rule
  must never require a code change.

## Decision engine output is never just yes/no
Always return: `status` (allowed | likely_allowed | denied |
not_enough_info | physically_unreachable | paid_available |
closed), `confidence` (0..1), and human-readable `reason`.

## Tech stack
- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 15, App Router, React — no Pages Router
- **Database:** SQLite via `better-sqlite3` (`db/entitlements.sqlite`) — 1 159 airports, 720 lounge rules, 21 alliance rule templates
- **ORM:** Drizzle ORM (`db/schema.ts`, `db/client.ts`)
- **Test framework:** `node --test` (built-in) — 95-case corpus in `lib/entitlements/__tests__/` + `lib/normalization/__tests__/`
- **Build / dev:** Turbopack (`npm run dev`), standard Next.js production build (`npm run build`)
- **PWA:** `app/manifest.ts` + `/public/sw.js` (cache-first, no webpack plugin)

## Commands
```bash
npm run dev       # Dev server — http://localhost:3000 (Turbopack)
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Type-check without emitting
npm test          # node --test runner (lib/entitlements, lib/normalization, lib/engine)
npm run compare-engines  # Diff old vs new engine on 95-case corpus
```

## Current architecture

### Rule database (`db/`)
SQLite via Drizzle ORM. Schema in `db/schema.ts`. Seed scripts in `scripts/`.
- `db/entitlements.sqlite` — 1 159 airports, 720 lounge rules, 21 alliance rule templates
- Rules: alliances → airlines → FFPs → status tiers; lounges → access channels → rules

### New entitlement engine (`lib/entitlements/`, `lib/engine/`, `lib/airport-services/`, `lib/normalization/`)
The production path for all lounge and airport-service decisions.
- `lib/entitlements/findEntitlementsAtAirport.ts` — main entry point; returns `AirportEntitlements`
- `lib/engine/evaluateLoungeAccess.ts` — per-lounge rule evaluation; returns `AccessResult` with 9-value status enum
- `lib/airport-services/findAirportServices.ts` — evaluates fast_track, priority_checkin, priority_boarding, priority_baggage
- `lib/normalization/normalize.ts` — maps (carrier, status card) → (PassengerContext, StatusContext)

### API routes (`/app/api/`)
- `POST /api/entitlements` — **production lounge + services path**; calls `findEntitlementsAtAirport`
- `POST /api/lounges` — **legacy** static-data path (@deprecated; kept for compare-engines harness)
- `POST /api/chat` — Gemini 2.5 Flash travel assistant (1500-token cap, language-mirroring prompt)
- `GET /api/flight` — flight number lookup from static database
- `GET /api/airports` — airport search

### UI (`/components/`)
- `Dashboard.tsx` — page orchestrator; owns all state; uses `useEntitlements` hook → `POST /api/entitlements`
- `EntitlementLoungeCard.tsx` — renders one `LoungeEntitlement` with 7-status visual + tap-expand reason
- `AirportServicesPanel.tsx` — shows all 4 airport services (fast track, check-in, boarding, baggage) as chips
- `TravelAssistant.tsx` — Gemini chat, receives enriched `ChatContext` including entitlements summary
- `SelectInput.tsx` — searchable dropdown

### Legacy (kept for compare-engines harness, not used by UI)
- `lib/loungeFilter.ts` — @deprecated; old boolean filter
- `lib/eligibility.ts` — @deprecated; old eligibility helpers
- `components/_v1-backup/` — V1 snapshots before engine swap; do not import

## What NOT to do
- Do not hardcode airline codes or status names in business logic.
- Do not couple lounge access logic with fast track logic.
- Do not return boolean access without reason and confidence.
- Do not modify existing migrations; create new ones.
- Do not add a new rule by changing `applyHardFilter` — the goal is
  to move rules into data so code never needs to change for new rules.
