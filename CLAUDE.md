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
- **Database:** None yet — rules currently live in static `.ts` files under `/data/` and `/data/lounges/`
- **ORM:** None yet
- **Test framework:** None yet — type-checking via `npx tsc --noEmit`, linting via ESLint
- **Build / dev:** Turbopack (`npm run dev`), standard Next.js production build (`npm run build`)
- **PWA:** `app/manifest.ts` + `/public/sw.js` (cache-first, no webpack plugin)

## Commands
```bash
npm run dev       # Dev server — http://localhost:3000 (Turbopack)
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Type-check without emitting
```

## Current architecture (as-is, to be evolved)

### Static rule data (`/data/`)
No database — entitlement rules are TypeScript objects compiled into the bundle.
- `data/lounges/` — lounge definitions split by alliance (`oneworld.ts`, `starAlliance.ts`, `skyteam.ts`, `independent.ts`) plus card-network lounges (`cardAndPerksData.ts`)
- `data/allianceRules.ts` — carrier→alliance mapping, status→tier mapping, tier→lounge class access matrix
- `data/airlineStatuses.ts` — loyalty programme definitions with `accessMethods[]`
- `data/creditCards.ts` — card definitions with `loungeAccess[]` networks

### Entitlement filter (`/lib/loungeFilter.ts`)
`applyHardFilter(lounges, ctx)` — evaluates each lounge against a `FilterContext`.
Key fields: `operatingCarrierCode`, `statusAccessMethods`, `cardNetworks`, `allowedAirlines`, `allianceAccess`.

`allianceAccess` controls the carrier check for alliance lounges:
- `'all-alliance'` — any carrier in the alliance + Sapphire/Emerald/Gold → access
- `'carrier-specific'` — carrier must be in `allowedAirlines` + tier must match

### Alliance-isolated router (`/data/lounges/index.ts`)
`getLoungeCandidates(params)` — returns only the relevant alliance pool (oneworld OR star-alliance OR skyteam, never mixed) plus any card-network lounges, then deduplicates.

### API routes (`/app/api/`)
- `POST /api/lounges` — resolves eligible lounges for a given flight + profile
- `POST /api/chat` — Gemini 2.5 Flash travel assistant (1500-token cap, language-mirroring prompt)
- `GET /api/flight` — flight number lookup from static database
- `GET /api/airports` — airport search

### UI (`/components/`)
- `Dashboard.tsx` — page orchestrator; owns all state
- `LoungeCard.tsx` — renders one lounge with tier styling and walking time
- `FastTrackStatus.tsx` — binary yes/no fast-track panel
- `SelectInput.tsx` — searchable dropdown

## What NOT to do
- Do not hardcode airline codes or status names in business logic.
- Do not couple lounge access logic with fast track logic.
- Do not return boolean access without reason and confidence.
- Do not modify existing migrations; create new ones.
- Do not add a new rule by changing `applyHardFilter` — the goal is
  to move rules into data so code never needs to change for new rules.
