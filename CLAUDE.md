# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## App name
Global Airport Guide (currently scoped to Helsinki-Vantaa / HEL data).

## Commands

```bash
npm run dev       # Start dev server on http://localhost:3000 (Turbopack)
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Type-check without emitting
```

## Architecture

### Data layer (`/data/`)
Static typed data files — no API calls, no database.
- `lounges.ts` — HEL airport lounge definitions with access methods, area (Schengen/Non-Schengen), tier, and amenities
- `creditCards.ts` — Cards with their lounge membership types (`priority-pass`, `lounge-key`, `dragon-pass`)
- `airlineStatuses.ts` — Airline loyalty tiers (Finnair Plus, Oneworld, Star Alliance, SkyTeam) with mapped access methods

### Eligibility engine (`/lib/eligibility.ts`)
`checkEligibility(card, status, lounges, area)` computes which lounges the user can access and whether Fast Track is available. It merges status access first, then card access (card never overrides a better status-based access). Lounges are returned sorted by tier (`ultra-premium → premium → standard`). The first result is always `bestLounge`.

### Components
- `Dashboard.tsx` — Main page orchestrator; owns all state and passes derived data to children
- `SelectInput.tsx` — Generic searchable dropdown used for card, status, and area selection
- `LoungeCard.tsx` — Renders one eligible lounge with tier styling; `isBest` prop highlights the top recommendation
- `FastTrackStatus.tsx` — Binary yes/no panel for Fast Track eligibility
- `ServiceWorkerRegistrar.tsx` — Client component that registers `/public/sw.js` for PWA offline support

### PWA
Uses Next.js App Router's built-in `app/manifest.ts` for the web manifest. Service worker is a plain file at `/public/sw.js` (cache-first for GET requests). No webpack plugin — compatible with Turbopack.

## Key domain rules (HEL-specific)

- **Finnair Platinum Wing** — only for `finnair-plus-platinum` or `oneworld-emerald`; highest tier
- **Finnair Lounge** (Schengen + Non-Schengen) — accepts Priority Pass in addition to Gold/Platinum status
- **Helsinki Airport Lounge** — Schengen only; accepts Priority Pass, LoungeKey, DragonPass
- **Fast Track** — granted by Finnair Plus Gold/Platinum, Oneworld Sapphire/Emerald, Star Alliance Gold, SkyTeam Elite Plus; credit cards do not grant Fast Track at HEL
- Flight number input is display-only plus airline name lookup; Schengen/Non-Schengen is user-selected via the area dropdown
