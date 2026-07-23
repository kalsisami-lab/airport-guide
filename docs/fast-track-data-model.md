# Fast track data model — schema fitness assessment

**Purpose:** Before backfilling 85 airports with fast track / priority
boarding / priority check-in rules, verify the current
`airport_service_rules` schema can express the access branches these
services need. If not, propose migration.

**Status:** Assessment complete. Current schema **CAN express** the
common access branches (tier, cabin, cards, program-tier) via existing
columns. Two gaps identified: (1) no terminal restriction, (2) tier
semantics need explicit convention. Migration proposed for terminal
restriction as optional follow-up.

## Real-world access branches

Every fast track has some combination of these access paths. Not every
airport has every branch, and the exact set differs by airport and by
service type (fast track vs. priority boarding vs. check-in).

| Branch | Example | How to model |
|---|---|---|
| **Alliance tier** | oneworld Sapphire+, Star Gold, SkyTeam Elite Plus | `min_alliance_tier` + `carrier_restriction` for alliance carrier list |
| **Cabin class** | Business/First ticket, any status | `conditions: {op:'in', field:'passenger.cabin', values:['business','first']}` |
| **Program-specific tier** | Finnair Plus Silver on AY flight | `min_alliance_tier: 'oneworld_ruby'` + `carrier_restriction: ['AY']` |
| **Cards** | Amex Platinum, Nordea Platinum, Aktia Visa Infinite | `provider: 'amex_centurion' \| 'nordea_fast_track' \| 'aktia_fast_track'` |
| **Priority Pass premium** | Priority Pass Select Access (some airports) | `provider: 'priority_pass_select'` (would need seeding) |
| **Paid** | Walk-in NOK 300 | `provider: 'paid'` |
| **Explicit deny** | Blackout list, blacklist carriers | `action: 'deny'` + carrier/condition |

## Current schema

```typescript
airport_service_rules: {
  id, airport_id, service_type ('fast_track_security' | ...),
  provider (nullable text),
  action ('allow' | 'deny', default 'allow'),
  notes (nullable text, UI display),
  min_alliance_tier (nullable enum: oneworld_*, star_*, skyteam_*, none),
  carrier_restriction (nullable JSON string[]),
  tier_semantics ('alliance_defined' | 'local', default 'local'),
  conditions (nullable Condition predicate JSON),
  ...rule columns (validFrom, validTo, priority, confidence, source_url, verified_at),
}
```

Predicate `conditions` supports: `equals`, `in`, `min_tier`,
`same_day_departure`, `country_equals`, `not`, `and`, `or`.

## Coverage: can current schema express each branch?

| Branch | Expressible? | How |
|---|---|---|
| Alliance tier | ✅ | `min_alliance_tier` + `tier_semantics='alliance_defined'` |
| Cabin class | ✅ | `conditions` in-list + `tier_semantics='local'` |
| Program-specific tier | ✅ | `min_alliance_tier` + `carrier_restriction=[AY]` + `tier_semantics='alliance_defined'` |
| Cards (Amex/Nordea/Aktia) | ✅ | `provider` = card key + `tier_semantics='local'` |
| Priority Pass premium | ✅ | `provider` = 'priority_pass_select' (new) — seed as needed |
| Paid | ✅ | `provider = 'paid'` |
| Explicit deny | ✅ | `action = 'deny'` + gates |
| **Terminal restriction** | ❌ | **No column, no predicate field** |

## Worked example: ARN

Real-world ARN fast track (as of 2026 per user's field observation):

1. Amex Platinum (any status): Fast Lane at T5, T4, T2
2. SAS Business ticket (any status): Fast Lane on SAS flights
3. SkyTeam Elite Plus (KLM/Delta): SkyPriority Lane at T4
4. Star Alliance Gold (Lufthansa/LOT etc.): Star Priority at T5
5. oneworld Sapphire+ (BA/AY/etc.): oneworld Priority
6. Fast Track Card (paid, ~30 EUR at door)

Modeled with current schema:

```sql
-- Alliance-defined tier branches
Rule A: {service_type: 'fast_track_security', min_alliance_tier: 'star_gold',
         tier_semantics: 'alliance_defined',
         notes: 'Terminal 5 Star Priority Lane'}
Rule B: {..., min_alliance_tier: 'skyteam_elite_plus', notes: 'Terminal 4 SkyPriority'}
Rule C: {..., min_alliance_tier: 'oneworld_sapphire', notes: 'Terminal 5 oneworld Priority'}

-- Cabin path (universal — SAS Business, KLM Business, etc.)
Rule D: {..., min_alliance_tier: null,
         conditions: {op:'in', field:'passenger.cabin', values:['business','first']},
         tier_semantics: 'local',
         notes: 'Business/First ticket'}

-- Card providers
Rule E: {..., provider: 'amex_centurion', tier_semantics: 'local',
         notes: 'Amex Platinum — Fast Lane at T5/T4/T2'}

-- Paid walk-in
Rule F: {..., provider: 'paid', tier_semantics: 'local', confidence: 0.9,
         notes: 'Fast Track Card ~30 EUR at door'}
```

**What we CAN express:** all 6 branches individually. Priority correctly
resolves via `priority` column when multiple rules match (e.g. Amex
holder in Business ticket → highest-priority rule wins).

**What we CANNOT express:** which terminal each branch actually operates
in. `notes` field only surfaces to UI — engine can't filter by
terminal. So if a Star Gold flying SAS asks about fast track at ARN,
engine returns `allowed` regardless of whether they're departing T5 or
T4 (in reality, Star Priority only exists at T5). Cross-terminal
misapplication is a false positive in the wrong direction.

## Worked example: LHR (post-PR C state)

Current DB has one rule (id=4) and one priority boarding rule (id=11):

```
Rule 4:  fast_track_security, oneworld_sapphire,
         [BA,IB,AA,CX,QF,JL,QR,AY], alliance_defined,
         notes 'Terminal 3 and Terminal 5 only'
Rule 11: priority_boarding, oneworld_emerald, same carriers, alliance_defined
```

Missing branches to seed for full LHR coverage:

```sql
-- Cabin path (universal for any oneworld carrier)
Rule NEW: {..., min_alliance_tier: null,
           conditions: {op:'in', field:'passenger.cabin', values:['business','first']},
           carrier_restriction: [same 8 oneworld carriers],
           tier_semantics: 'local',
           notes: 'Business/First ticket on oneworld carrier'}

-- Amex Centurion (if applicable — user should verify)
Rule NEW: {..., provider: 'amex_centurion', tier_semantics: 'local',
           notes: 'Amex Platinum lounge access variants'}
```

Same terminal-filtering gap as ARN.

## Gap analysis: terminal restriction

### Why it matters

LHR: T2 (Star), T3 (oneworld outstations), T4 (SkyTeam + QR), T5 (BA).
Fast track available T3 & T5 only per oneworld data. Currently modeled
by narrowing the carrier list to [BA,IB,AA,CX,QF,JL,QR,AY] — indirect
proxy. Works only because oneworld carriers happen to be T3/T5-only at
LHR. Breaks down for:

- ARN Star Priority at T5 only (Star Gold flying LO/OS/SN sometimes
  depart T4 → shouldn't get access at those flights)
- Any airport where the same alliance operates from multiple terminals
  with fast track in only some of them

### Options

**Option A — new column `terminal_restriction`**
```sql
ALTER TABLE airport_service_rules ADD COLUMN terminal_restriction TEXT;
-- JSON string array of terminal identifiers (from airports.iata_code
-- + terminals.name, or terminals.id if we normalize)
```

Engine change: gate rule match on `terminal_restriction === null ||
terminal_restriction.includes(passenger.terminal)`. Same pattern as
`carrier_restriction`.

Requires: capturing `passenger.terminal` in `PassengerContext` (new
field). Currently absent. Would need UI signal (terminal-select
dropdown) or automatic derivation from flight number → terminal lookup
(fragile — terminal assignments change).

**Option B — use existing `conditions` predicate**
```
conditions: {op: 'equals', field: 'passenger.terminal', value: 'T3'}
```

Requires the same PassengerContext extension + `resolveField` in
predicates.ts already supports arbitrary field paths.

More flexible (compose `or` of terminal values) but same underlying data
requirement.

**Option C — skip terminal support for now**
Use `notes` field to surface terminal info to UI. Engine over-permits
(reports fast track available even when at a terminal that doesn't
have it), but errs on the honest-but-not-quite-precise side. Add
column later when a user reports a false positive.

### Recommendation

**Option C for the initial 85-airport backfill.** Rationale:

1. **Coverage gain > precision gap.** Airports with fast track modeled
   (even imprecisely) is a UX improvement over airports returning
   `not_enough_info`. Terminal precision is already imperfect in
   reality (terminal assignments change per flight).

2. **UI signal missing anyway.** To use option A or B we'd need the
   user to input their terminal, which the current Dashboard doesn't
   ask for. Adding a terminal field to the UI is a separate design
   decision.

3. **Schema addition is non-breaking.** `terminal_restriction` is an
   additive column — nothing has to change in existing rules or code
   paths for it to land later. Absent-column semantics ("any terminal")
   is preserved forever for old rows. This makes deferring the column
   a strictly reversible decision: seed now, refine later.

4. **Existing `notes` field preserves the source info.** Terminal
   context ("Fast track available T3 & T5 only") is captured in
   `notes` as human-readable text and shown to the UI. When the
   column lands, the extraction path is `notes → terminal_restriction`.
   No data is lost by deferring.

**Not a rationale (deliberately):** the trade-off between false positive
("said fast track available, but I was at wrong terminal") vs. false
negative ("said not available, but I was in a terminal where it was")
is NOT the argument here. Per §56 and §60, in this app's context the
false positive is the more expensive direction — the user changes
queues to a fast lane, is refused, and has to walk back (visible
inconvenience) — whereas the false negative just means asking at the
counter. Terminal-agnostic rules skew toward false positives, so
Option C is a precision debt we're taking on knowingly. The reason we
accept it is #3 (cheap, reversible migration), not that the false
positive is somehow fine.

Log terminal info in `notes` field for all rules seeded during
backfill, even if engine can't filter by it. Then upgrade path is:
add column, extract from notes to structured field, wire up UI.

## Gap analysis: tier_semantics convention

The `tier_semantics` column added in §64/PR C has two values:
`'alliance_defined'` and `'local'`. Convention codified so far:

- `alliance_defined` when: (a) service is fast_track_security /
  priority_boarding / priority_checkin, AND (b) `min_alliance_tier` is
  set (i.e. rule expresses an alliance's own tier requirement).
- `local` for everything else.

**Not yet decided:**
- `priority_baggage` — arguably also alliance-defined (Sapphire+ per
  oneworld) but user's explicit scope excluded from initial rollout.
- Star Alliance / SkyTeam service rules — currently marked
  `alliance_defined` if they use `star_gold` / `skyteam_elite_plus`.
  Correct because those alliances also define these benefits.
- Program-specific tiers (Finnair Silver, BA Gold Guest List) — modeled
  as `alliance_defined + oneworld_ruby + [AY]` (HEL rule id=12). Is
  this correct? Ruby is technically a oneworld tier so alliance_defined
  reads OK. But the actual benefit isn't oneworld-wide — it's
  Finnair-specific. Consider: is this over-claiming alliance-level
  certainty for a program-specific benefit?

**Recommendation:** for backfill, apply the same convention already in
use. Revisit program-specific-tier classification if a user reports
being denied fast track at HEL as a Finnair Silver on a non-AY oneworld
carrier.

## Summary

**Schema fitness for backfill: ✅ ready** for the common branches
(tier / cabin / cards / paid). Terminal restriction is the one gap.
Recommend punting on terminal filtering for now (option C) and shipping
the coverage improvement first.

**Ready to backfill.** Suggested rule template per airport (adjust for
airport specifics):

```
1. alliance_defined oneworld_sapphire (if oneworld carriers present)
2. alliance_defined star_gold           (if Star Alliance carriers)
3. alliance_defined skyteam_elite_plus  (if SkyTeam carriers)
4. local cabin=business|first, no min_tier
5. provider=amex_centurion if airport supports
6. provider=paid if airport has walk-in
```

Notes: capture terminal info even though engine won't filter. Priority:
alliance_defined tier rules first (high signal), then cabin (mid), then
cards (low but often applies), then paid (fallback).

### Mandatory precondition: source verification

Rules 1–3 (alliance_defined tier gates) may **only** be seeded for
an airport that has a **primary-source-verified** fast track offering
for that alliance. Same threshold as `alliance_defined` semantics
(§64): if we mark it as authoritative, we must have evidence that
authority holds at this airport.

Acceptable primary sources:

- Airport's own website page listing "Fast Track" or a named priority
  lane, referenced in `source_url`.
- Alliance benefit page (oneworld.com/star-alliance/skyteam) declaring
  the tier benefit is available AND naming the airport (or the airline
  hub that implies operation there).
- First-hand user field report with airport + terminal + carrier + tier.

**Not acceptable:**

- "Alliance policy says Sapphire+ gets fast track" as a global rule
  without airport-specific confirmation — many airports don't operate
  a fast lane at all, or don't extend the alliance benefit
  reciprocally.
- Assumption based on "airport X is served by carrier Y, so Y's
  benefits must apply" — some outstation airports have zero priority
  infrastructure.

**Without primary-source verification, the airport stays in
`not_enough_info` (?) for that service.** Seeding rules 4–6 (cabin,
cards, paid) is also gated on verification of that specific path —
e.g., a card provider rule requires evidence that the specific card is
accepted at that specific airport.

### Recording provenance per rule

Every backfilled rule row **must** populate:

- `source_url` — URL to the primary source that verifies this rule.
  If the source is a user field report, use a stable URL that reflects
  the context (e.g., a permanent report note or issue reference); do
  not leave blank.
- `verified_at` — ISO date (`YYYY-MM-DD`) of the verification. For
  scraped data, the scrape date. For user field reports, the trip
  date. For airport-website content, the date the page was last
  checked.

Rules without both fields set are considered unverified and should be
reviewed (or migrated back to `not_enough_info` for that service). A
future audit script can flag `source_url IS NULL OR verified_at IS
NULL` rows.

**Example rule with full provenance:**

```typescript
{
  service_type: 'fast_track_security',
  airport_id: <ARN>,
  min_alliance_tier: 'star_gold',
  tier_semantics: 'alliance_defined',
  notes: 'Star Priority Lane, Terminal 5. Star Alliance Gold benefit.',
  source_url: 'https://www.swedavia.com/arlanda/services/fast-track/',
  verified_at: '2026-07-23',
  confidence: 0.95,
}
```

## Follow-up work (out of scope for backfill)

- `terminal_restriction` column + `PassengerContext.terminal` field +
  UI terminal picker. Roll out when a user reports a false positive
  or when we want tighter accuracy.
- `priority_baggage` promotion to `alliance_defined` if same UX
  treatment desired.
- Reconcile program-specific-tier convention with §56 (program-tier
  abstraction gap) — currently modeled loosely via
  `oneworld_ruby + carrier_restriction`.
