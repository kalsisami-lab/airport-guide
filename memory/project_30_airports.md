---
name: project-30-airports
description: Modular alliance-isolated lounge architecture in data/lounges/; 30 airports, 124 lounges, strict routing
metadata: 
  node_type: memory
  type: project
  originSessionId: b5cd1510-102a-487a-9f08-99858385e827
---

Lounge database is now fully modular with strict alliance isolation.

**Architecture: data/lounges/**
- `types.ts` — StaticLounge type definition
- `oneworld.ts` — 15 airports, ~34 lounges (includes HEL hybrid Finnair lounges exported as HEL_FINNAIR_HYBRID_LOUNGES)
- `starAlliance.ts` — 16 airports, ~31 lounges
- `skyteam.ts` — 9 airports, ~15 lounges
- `cardAccess.ts` — 25 airports, ~32 entries (imports HEL hybrid from oneworld.ts to avoid duplication)
- `independent.ts` — 9 airports, ~12 airline-own lounges (Emirates, Qatar First, AF La Première, etc.)
- `index.ts` — router (`getLoungeCandidates`), re-exports, `LOUNGE_DATABASE`

**Airports in LOUNGE_DATABASE (30 total):**
Europe Schengen: HEL, AMS, ARN, CDG, FCO, FRA, MAD, MUC, ZRH
Europe non-Schengen: IST, LHR
Middle East: DOH, DXB
Asia-Pacific: BKK, HKG, ICN, KUL, NRT, PEK, PVG, SIN, SYD
North America: JFK, LAX, MIA, ORD, SFO, YYZ
South America/Africa: GRU, JNB

**Router isolation logic (getLoungeCandidates in index.ts):**
- Detects alliance from carrier code first, then status methods
- Only loads matching alliance's dataset (oneworld OR star-alliance OR skyteam, never mixed)
- Always adds card pool if hasCard=true
- Always adds independent (airline-own) pool — loungeFilter handles carrier matching
- Deduplicates by lounge id (hybrid lounges appear in both oneworld + card pools)

**API route change:**
app/api/lounges/route.ts now calls getLoungeCandidates() instead of LOUNGE_DATABASE[iata] directly.

**data/loungesData.ts** converted to a 2-line re-export shim for backward compatibility.

**Alliance rules (data/allianceRules.ts):**
- Added A3 (Aegean Airlines) → star-alliance

**Key IDs that match walkingTime.ts (must not be renamed):**
LHR: lhr-ba-concorde-room, lhr-ba-first-lounge, lhr-ba-galleries-club, lhr-aspire-t5, lhr-no1-lounge-t2
AMS: ams-klm-crown-schengen, ams-klm-crown-non-schengen, ams-aspire-lounge
CDG: cdg-af-salon-schengen, cdg-af-salon-non-schengen, cdg-aspire-lounge-schengen, cdg-extime-lounge-non-schengen
ARN: arn-sas-business-schengen, arn-sas-gold-lounge, arn-no1-lounge
HKG: hkg-cx-wing-first, hkg-cx-wing-business, hkg-cx-pier-first, hkg-cx-pier-business, hkg-plaza-premium

**Why:** User wanted strict alliance isolation (AY Finnair Platinum must NEVER see LH/Star Alliance lounges) and modular file structure to prevent bloat.
**How to apply:** When adding lounges, put them in the correct alliance file. Add airline-own-only lounges to independent.ts. Hybrid (alliance+PP) lounges go in cardAccess.ts via import from alliance file.
