# Data Integrity TODOs

Known gaps in `db/entitlements.sqlite` that require future verification before adding rules.

---

## 1. airline_own rules with no cabin/tier condition

**Risk:** Any `airline_own` rule where `conditions IS NULL` grants lounge access to
ALL passengers of the listed carriers, regardless of cabin or status tier. This was the
root cause of the LH First Class Lounge bug (Phase 13).

**Audit query:**

```sql
SELECT
  a.iata_code,
  l.name          AS lounge,
  lac.id          AS channel_id,
  lar.id          AS rule_id,
  lar.carrier_restriction,
  lar.conditions,
  lar.source_url
FROM lounges l
JOIN airports a ON a.id = l.airport_id
JOIN lounge_access_channels lac ON lac.lounge_id = l.id
JOIN lounge_access_rules lar ON lar.channel_id = lac.id
WHERE lac.channel_type = 'airline_own'
  AND lar.conditions IS NULL
ORDER BY a.iata_code, l.name;
```

Run this query and review each lounge. Expected question per row:
*"Should ANY passenger on these carriers have access, or only business/first/status?"*

**Fixed:** LH First Class Lounge FRA (rule id=13) — added `conditions = { op:'in', field:'passenger.cabin', values:['first'] }` in Phase 13.

---

## 2. Lessons: Aspire-operated lounges and data sourcing

**Learning A — operator brand ≠ access channels:**
OP Lounge by Aspire at HEL (id=4) was incorrectly seeded in Phase 14 with PP/LK/DP
channels, inherited from the assumption that all Aspire-operated lounges share the same
access. The OP-branded lounge uses bank-card (op_card) access, not the general Aspire /
Plaza Premium PP/LK/DP network.

**Learning B — alliance-wide ≠ contract-based:**
A second fix (Phase 14 v2) removed an incorrect `oneworld_sapphire / all_alliance` rule.
OP Lounge access is contract-based per partner airline, not alliance-wide. Confirmed
partner: Lufthansa (LH, star_gold minimum). AY passengers are excluded because Finnair
has its own lounge at HEL.

**Learning C — two-source verification:**
The incorrect oneworld rule was added from a single secondary source. The OP Group
opening article (1/2025) and a secondary source together clarified the real access model.
Always cross-reference at least two sources before adding alliance-level rules.

**Rule going forward:** when adding a bank- or airline-branded lounge operated by a third
party (Aspire, Plaza Premium, etc.), verify access channels per-lounge. Do NOT inherit
from the operator's other lounges, and do NOT assume alliance-wide access from a
single secondary source.

---

## 3. OP Lounge partner airlines — only LH confirmed

**Risk:** OP Lounge serves passengers of partner airlines that have no own lounge at HEL.
Currently only Lufthansa (LH) is confirmed (channel id=53, `star_gold`, `carrier_restriction=['LH']`).
Other Star Alliance carriers without HEL lounge may also have contracts, but are NOT verified.

**Possible partners (unconfirmed):** SWISS (LX), Austrian Airlines (OS), KLM (KL), Air France (AF).

**Action needed:** Verify via OP Financial Group press releases, Finavia, or direct carrier
contact before adding LX/OS/KL/AF to `carrier_restriction` on rule id=53.

---

## 4. LH rule tier — is star_silver sufficient at OP Lounge?

**Risk:** Rule id=53 requires `min_alliance_tier = 'star_gold'` (Senator). The original source
says "sopimuslentoyhtiöiden tasokorttiasiakkaita" (status card customers of partner airlines)
without specifying which tier. Conservatively set to star_gold.

**Action needed:** Verify whether Miles & More Frequent Traveler (star_silver) also grants
access. If yes, lower `min_alliance_tier` on rule id=53 to `'star_silver'`.

---

## 5. Aspire Gate 13 + OP Gold access removed 1/2025

**Status: already correct in DB.** OP Group article (1/2025) states that OP Gold/Platinum
cardholders can no longer access Aspire Gate 13 (id=25) from January 2025. Confirmed:
lounge id=25 has no `op_card` channel in the database.

**No action needed.** Documented here for traceability.

---

## 6. Plaza Premium HEL non-Schengen — OP card access unmodelled

**Status: RESOLVED (Phase 16).** Plaza Premium Lounge added at HEL (id=27, non_schengen)
with `op_card` channel (conf 0.9). See `db/patch-hel-plaza-premium.ts`.

---

## 7. Seed missing oneworld carriers into the airlines table

**Risk:** Any `all_alliance` rule for oneworld derives access from `passenger.operatingAlliance`,
which is looked up from the `airlines` table at runtime. Currently seeded oneworld members:
`AA, AY, BA, IB, JL, QR`. Passengers on unseeded carriers receive `null` alliance → denied.

**Unseeded oneworld members** (absent from `airlines` table as of 2026-06-15):
CX (Cathay Pacific), MH (Malaysia Airlines), QF (Qantas), RJ (Royal Jordanian),
AT (Royal Air Maroc), UL (SriLankan Airlines), WY (Oman Air).

**Action needed:** Seed missing carriers into `airlines` with `alliance_id = 1` (oneworld).
No rule change needed — the `all_alliance` mechanism picks them up automatically.

---

## 8. Star Alliance Gold access at HEL Aspire Lounges

**Risk:** Aspire Lounge by Gate 13 (id=25) and Gate 27 (id=26) at HEL may grant
Star Alliance Gold access through Plaza Premium's network agreements. Not verified:
Star Alliance lounge finder, Finavia, and Plaza Premium were unreachable during Phase 12.

**Action needed:** Verify via Star Alliance lounge finder
(`https://www.staralliance.com/en/lounge-finder`) or Plaza Premium directly before
adding an `alliance_status` channel with `min_alliance_tier = 'star_gold'`.

---

## 9. HEL Plaza Premium Lounge — not yet added

**Status: RESOLVED (Phase 16).** Added as lounge id=27 with 5 access channels
(priority_pass, lounge_key, dragon_pass, op_card, paid), all confidence 0.9.
Sources: Finavia + Plaza Premium official brochure. See §13, §14, §15 below
for remaining follow-ups.

---

## 10. Schengen zone for HEL Aspire Lounges — low-confidence Wikipedia source

**Risk:** HEL Aspire Lounge by Gate 13 (id=25) and Gate 27 (id=26) are set to
`area = 'schengen'` at confidence 0.8, based on Wikipedia ("gates 5–36 = Schengen flights").
Finavia's official site was unreachable for cross-check during Phase 12.

**Action needed:** Verify via Finavia (`https://www.finavia.fi/en/airports/helsinki-airport`)
or airport map before increasing confidence or relying on zone filtering for these lounges.

---

## 11. Other "by Aspire" and bank lounges in Finland — data gap

**Risk:** OP Lounge by Aspire is operated by Plaza Premium / Aspire. Similar branded
lounges may exist at other Finnish airports (TMP — Tampere-Pirkkala, TKU — Turku) that
are not yet in the database. Additionally, other Finnish banks offer lounge benefits
(Nordea Platinum is in `data/creditCards.ts` but has no corresponding lounge rule),
and Danske Bank may offer similar products.

**Action needed:** Verify via Finavia regional airport pages and bank card benefit pages:
- TMP / TKU: any Aspire-branded or Plaza Premium lounges?
- Nordea Platinum Mastercard: which lounges does it access at HEL?
- Danske Bank premium cards: any Finnish lounge access?

---

## 12. 718/720 lounge_access_rules without source_url

Most rules were seeded without `source_url` or `verified_at`. This is not an immediate
correctness risk but means rules cannot be re-verified or traced to their origin.

**Recommended approach:** Prioritise adding sources for:
1. Rules that are currently granting access (`allowed`/`likely_allowed`) to high-traffic routes
2. Any `alliance_status` rule with `min_alliance_tier` in the top 2 tiers per alliance
   (i.e., emerald, star_gold, elite_plus) — wrong data here has the highest impact

No bulk fix recommended — source verification requires per-rule human review.

---

## 13. Plaza Premium HEL opening hours — source conflict

**Risk:** Finavia lists Plaza Premium HEL hours as 06:00–00:00, while an earlier Plaza
Premium source listed 10:00–23:59. The DB currently stores Finavia's 06:00–00:00.

**Action needed:** Verify on-site or via Plaza Premium directly before relying on early-
morning availability (05:30 arrivals for the first Asian outbound wave).

---

## 14. Plaza Premium HEL PP/LK/DP channels — inferred from network membership

**Risk:** The `priority_pass`, `lounge_key`, and `dragon_pass` channels on Plaza Premium
HEL (id=27) are set from Plaza Premium's network membership (PP owns DragonPass; LK is
the parallel Mastercard network). The Plaza Premium brochure confirms access but the
patch source URL is generic, not a per-app lounge listing.

**Action needed:** Cross-check by looking up "Helsinki Airport" in the Priority Pass app,
LoungeKey lounge finder, and DragonPass app. Update `source_url` on rules 54/55/56
with the exact per-app deep link once verified.

---

## 15. schema.ts channel_type enum drift from DB

**Risk:** `db/schema.ts` declares `channel_type` enum as
`['alliance_status','airline_own','priority_pass','lounge_key','dragon_pass','amex_centurion','paid','invitation']`
but the DB now contains `op_card` (rule id=52 on OP Lounge, rule id=57 on Plaza Premium).
SQLite ignores CHECK enums, so this works at runtime, but Drizzle's TypeScript types
reject `op_card` — which is why `patch-hel-op-lounge-fix.ts`, `patch-hel-op-lounge-rules-v2.ts`,
and `patch-hel-plaza-premium.ts` all use raw `better-sqlite3` instead of the ORM.

**Action needed:** Add `'op_card'` (and any other DB-only values discovered later) to the
enum in `db/schema.ts`. Growing debt — each new bank-branded channel widens the gap.

---

## 16. Confidence field carries two meanings — document or split

**Risk:** `lounge_access_rules.confidence` is used by
`lib/engine/evaluateLoungeAccess.ts:confidenceToStatus` to bucket results:
`>= 0.85 → allowed`, `0.60–0.84 → likely_allowed`, `< 0.60 → not_enough_info`.

This overloads a single field with two questions that can conflict:
  (a) "How confident are we that a passenger who matches this rule actually gets in?"
      (real-world access reliability — e.g. fringe cases where gate agents deny valid PP holders)
  (b) "How confident are we that this rule is correctly transcribed?"
      (data-quality metadata — e.g. inferred from a blog vs verified against Finavia)

A rule with strong data provenance but real access variability (e.g. contract lounge that
sometimes turns away crowded PP holders) currently shares the same slider as a rule with
uncertain provenance. There is no way to express "we're sure it's coded correctly but the
real-world outcome is unreliable" — or vice versa.

**Action needed:** Either
  (a) document the current convention explicitly in `lib/engine/evaluateLoungeAccess.ts`
      (a header block near `confidenceToStatus`), OR
  (b) split into two fields: `accessConfidence` (drives status bucket) and
      `sourceConfidence` (metadata only). Migration cost is real — 720 existing rules.

Recommendation: start with (a). Escalate to (b) if we hit a case where the two meanings
genuinely diverge and mislead a user.

---

## 17. Finnair Lounge / Platinum Wing HEL — over-restricted alliance rules

**Status: RESOLVED (Phase 21).** Channel rules 1, 2, 3 previously had
`alliance_access='carrier_specific'` with `carrier_restriction=['AY']`, which
incorrectly limited alliance access to Finnair passengers only. Under oneworld
rules, any Sapphire (Business/frequent flyer lounges) or Emerald (First-class
lounges) status holder on any oneworld carrier can access. Fixed to
`all_alliance` per `db/patch-hel-finnair-oneworld.ts`.

Sources (two-source verification per §14 lesson C):
  - oneworld.com/airport-lounges (primary)
  - The Pointy Miles / HFP Platinum Wing reviews (secondary)

`airline_own` channels (id=40, 41) with `carrier_restriction=['AY']` are
correct and NOT changed — those model Finnair's own-airline access as a
separate dimension.

---

## 18. Finnair HEL lounge weekend restriction claim — unverified

**Risk:** One secondary source (theluxurytraveller.com review) claims that
oneworld Sapphire holders have no access to Finnair's Premium Lounge (or
Platinum Wing — the source is ambiguous) on weekends. This contradicts the
oneworld.com policy, which lists no day-of-week restrictions, and would only
make sense if Finnair extended Platinum-Wing courtesy access to Sapphires
during weekdays (a Finnair-specific extension beyond alliance rules), then
withdrew it on weekends.

**Action needed:** Verify whether this restriction exists in current policy
(FlyerTalk threads, Finnair.com FAQ, direct experience). If real, model as a
`conditions` predicate or a blackout `exception_rule` on lounge id=1 or id=2,
restricted to `day_of_week in (Sat, Sun)`.

Do **not** add this restriction based on the single blog claim alone.

---

## 19. Seed missing Star Alliance / SkyTeam carriers

**Status: PARTIAL (Phase 21).** SK (SAS) added to `airlines` with
`alliance_id = 2` (star_alliance) to support the Phase 21 fallback logic
(distinguish `allianceMismatch` from `allianceUnknown`).

**Still missing:** SN (Brussels), OS (Austrian), OZ (Asiana), TG (Thai),
SQ (Singapore), CA (Air China), NZ (Air NZ) — Star Alliance;
MU (China Eastern), KE (Korean Air), RO (Tarom), VN (Vietnam), CI (China
Airlines), MF (Xiamen), GA (Garuda), UX (Air Europa), SV (Saudia) — SkyTeam.

**Action needed:** As the airport catalogue expands beyond the PoC 5 airports,
seed these carriers so that alliance-mismatch detection works correctly for
users flying them. Without seeding, `getAllianceForCarrier(X) = null` triggers
`likely_allowed` (Phase 21 fallback) which is less informative than the true
`not_applicable`.

Ripple effect: also update `data/airlineStatuses.ts` /
`hooks/useEntitlements.STATUS_TO_DB` if new FFPs are needed for testing.

---

## 20. UI rendering of `not_applicable` and `likely_allowed` statuses

**Risk:** Phase 21 added two new outcomes to the engine that previously did
not appear for lounge access:

  - `not_applicable` — alliance mismatch (e.g. oneworld status + SAS flight
    at an oneworld lounge). New source: `alliance_mismatch`.
  - `likely_allowed` — carrier unknown but alliance status meets tier. New
    source: `alliance_unknown_carrier`. Confidence 0.6.

**Action needed:** Verify that `components/EntitlementLoungeCard.tsx` renders
these statuses with appropriate colour, icon, and reason text. Check:
  - Does the sort order in `STATUS_SORT` (types.ts) still make sense with
    real-world mix (allowed first, then likely_allowed, then paid, then
    not_applicable, then denied)?
  - Does `likely_allowed` communicate the "add your flight" CTA visually,
    or does the reason text alone suffice?
  - Does `not_applicable` distinguish clearly from `denied`? Currently they
    look similar; users may benefit from a different visual treatment
    (e.g. muted colour + "for a different alliance" caption).

---

## 21. Restricted paid channels — Finnair Lounge Silver discount

**Status: RESOLVED (Phase 21b).** Finnair Lounge (id=2 non-Schengen, id=3
Schengen) now carries a restricted paid channel:
`min_alliance_tier = oneworld_ruby`, `carrier_restriction = ['AY']`,
`priority = 50`.

**Engine change:** paid rules are evaluated in the main channel loop (Phase 21b)
instead of via the `hasPaidChannel` flag. Alliance-mismatch / alliance-unknown
signals still take precedence over paid_available so a user on the wrong
alliance sees `not_applicable`, not `paid_available`.

**Effect on Silver:**
  - AY Silver + AY Economy → `paid_available` (via this new rule)
  - AY Silver + AY Business/First → `allowed` (via existing airline_own
    cabin rule at priority 90)
  - No status + AY flight → `denied` (paid rule requires ruby tier — Finnair
    Lounge is NOT open walk-in like Aspire)
  - BA Silver + BA flight → `denied` (carrier ≠ AY)
  - Silver + Schengen-only flight → non-Schengen lounge is
    `physically_unreachable` (zone check unchanged)

**NOT modelled:** Silver discount price (30 € / 4800 Avios per Finnair.com).
The engine's `paid_available` status has no price field. Add a price/currency
column or an amenity-style hint in `LoungeInputWithMeta` if the UI needs to
show the discount amount.

Source: https://www.finnair.com/en/smooth-travelling-at-helsinki-airport/finnair-lounges-at-helsinki-airport

---

## 22. carrier_specific-hylkäys palauttaa geneerisen denied/paid-viestin

**Risk:** When an `alliance_status` + `carrier_specific` rule fails because the
passenger's operating carrier is not in the rule's `carrier_restriction`, the
engine returns null → falls through to `denied` or `paid_available`. The user
does not learn *which* carriers the lounge serves — just that they don't have
access.

Example: at ARN Pearl Lounge C37, an AY passenger with oneworld Sapphire
status gets `paid_available` (walk-in) with no explanation that the lounge's
alliance access is scoped to BA/QR only.

**Action needed:** UX enhancement — add a `carrierMismatch` fallback signal
mirroring Phase 21's `allianceMismatch`. Track the union of carrier
restrictions across `alliance_status carrier_specific` rules that would have
matched except for the carrier check. Emit a status/reason like:
"This lounge serves BA and QR flights only." (`not_applicable` or a new
sub-status of denied.)

Not urgent — issue recurs at any oneworld hub with carrier-restricted lounges
(HEL Finnair Lounge post-§17 was reduced to all_alliance, but ARN Pearl T2 and
C37 both use carrier_specific; will also apply to future FRA/LHR seeding).

---

## 23. ARN 60° Lounge (non-Schengen, Gate F67) — not modelled

**Risk:** Stockholm-Arlanda has a non-Schengen "60° Lounge" at Terminal 5 Gate
F67 whose access rules are not yet confirmed from primary sources.

**Action needed:** Confirm via Swedavia + oneworld lounge finder + Priority
Pass whether the lounge accepts oneworld status, PP/LK/DP, or is airline-
specific. Once confirmed, add via a Phase 22b-style patch.

---

## 24. SAS Lounges at ARN — Star Alliance, low priority

**Risk:** SAS operates its own lounges at ARN (Business Lounge, Gold Lounge)
open to Star Alliance status. Not added because the current data focus is
Finnair-passenger-relevant lounges.

**Action needed:** Seed when the app expands beyond Finnair-focused defaults.
Requires the remaining Star Alliance carrier seeding tracked in §19.

---

## 25. Pearl Lounge Terminal 2 (ARN) opening hours unknown

**Risk:** Swedavia's service page for ARN lists Pearl Lounge C37 hours
(06:30–20:30) but not for the Terminal 2 lounge. The DB row has
`opening_hours = NULL` for the T2 lounge, which means the engine will not
close it outside real operating hours.

**Action needed:** Confirm T2 hours from Swedavia or Plaza Premium and
`UPDATE lounges SET opening_hours = ? WHERE id = 28`. Until then, the lounge
appears always-open in the UI, which may produce false "allowed" results
early morning or late night.

---

## 26. AGP Sala VIP opening hours — source conflict

**Risk:** Aena's website lists Sala VIP AGP as "00:00–23:59" (implying 24h);
Priority Pass and secondary review sources list 05:30–22:30. The DB row uses
`Daily 05:30–22:30` conservatively so the engine returns `closed` outside
those hours instead of `paid_available` overnight.

**Action needed:** Verify on-site (Sami will confirm during Málaga trip)
whether the lounge is actually open overnight. If yes, update to 24h.

---

## 27. AGP Sala VIP LK/DP channels — inferred from PP network

**Risk:** The `lounge_key` (conf 0.85) and `dragon_pass` (conf 0.8) channels
on Sala VIP (id=31) are set from PP-network membership, not a per-app
verification. Priority Pass lists Sala VIP directly (conf 0.9), but LK/DP
are inferred to also work (same operator, same access model).

**Action needed:** Confirm by looking up "Málaga Airport" in the LoungeKey
and DragonPass apps. Update `source_url` on the respective rules to the
per-app deep link once verified.

Same inference pattern as §14 (Plaza Premium HEL PP/LK/DP). Track together
if these need to be re-verified in bulk.

---

## 28. CPH Aviator lounges opening hours unknown

**Risk:** cph.dk publishes opening hours for Aspire (06:00–20:00) and Eventyr
(05:30–20:00) but not for Danske Bank Aviator Business Lounge or Carlsberg
Aviator Lounge. Both DB rows have `opening_hours = NULL`, so the engine will
not close them outside real operating hours and may return `allowed` or
`paid_available` early morning / late night when the lounges are actually
shut.

**Action needed:** Verify on-site or via cph.dk operator listing, then
`UPDATE lounges SET opening_hours = ? WHERE id IN (32, 35)` (Danske Bank
Aviator, Carlsberg Aviator).

Same shape as §25 (ARN Pearl Lounge T2 hours unknown).

---

## 29. Eventyr Lounge alias "Pearl Lounge" + Danske Bank Aviator channel oddity

**Risk (a):** oneworld.com lists the Eventyr Lounge at CPH under the name
"Pearl Lounge" (unrelated to Plaza Premium's Pearl Lounges at ARN — same
brand name, different operators). The `lounges` table has no `aliases`
column, so the alias is only recorded in `location_description` as
"(oneworld.com lists as 'Pearl Lounge')". A future search by that name
will not find the row.

**Risk (b):** Danske Bank Aviator Business Lounge (id=32) has `lounge_key`
and `dragon_pass` channels but NOT `priority_pass`. This combination is
unusual — most LK/DP lounges are also on the PP network. If a later source
confirms Danske Bank Aviator is in fact PP-listed, add the PP channel.

**Action needed (a):** Schema migration adding `lounges.aliases` (TEXT,
JSON array of strings), backfill Eventyr with `["Pearl Lounge"]`, then
strip the parenthetical from `location_description`.

**Action needed (b):** Cross-check prioritypass.com Copenhagen listing for
Danske Bank Aviator specifically. If present, add PP channel via a small
patch and remove this note.

---

## 30. Danske Bank customer channel modeling (`bank_partner`)

**Risk:** Danske Bank customers currently reach the Danske Bank Aviator
Business Lounge via the `lounge_key` channel, because `data/creditCards.ts`
maps `danske-platinum` → `loungeAccess: ['lounge-key']`. This works for the
current card catalog but conflates two access rights: LK network membership
and bank-branded lounge access. Real Danske Bank World Elite / private
banking cards may have broader guest policies at this lounge than LK gives.

**Action needed:** When a card in the catalog requires access broader than
LK (guest count, no-blackout, etc.), introduce a `bank_partner` channel
type in `lib/engine/types.ts::ChannelType`, add UI card→channel mapping in
`hooks/useEntitlements.ts`, and re-issue the Danske Bank Aviator channels
with `bank_partner` alongside `lounge_key`.

---

## 31. SAS Lounges at CPH — Star Alliance, low priority

**Risk:** SAS operates multiple own lounges at CPH (Business/Gold, Schengen
and non-Schengen) open to Star Alliance status. Not added because current
data focus is Finnair-passenger-relevant lounges.

**Action needed:** Seed when the app expands beyond Finnair-focused
defaults. Same deferral as ARN §24 — track together with the remaining
Star Alliance carrier seeding from §19.

---

## 32. OSL Lounge / Premium — weekday-scoped opening hours

**Risk:** OSL Lounge (id=36) is `Mon-Fri 05:30–20:30` — closed Sat/Sun.
OSL Premium (id=37) is `Mon-Fri 09:00–19:00, Sat closed, Sun 12:00–19:00`.
The `opening_hours` column is a single free-text string and the engine's
closed-check does not parse weekday scopes. Result: a Saturday query will
return `allowed`/`paid_available` even though OSL Lounge is physically
closed.

**Action needed:** Extend the engine's opening-hours parser to understand
weekday prefixes (`Mon-Fri`, `Sat closed`, `Sun 12:00–19:00`), or split
`opening_hours` into a structured column (JSON: `{mon: "05:30-20:30",
sat: null, ...}`). Prefer the parser — schema change costs more than the
regex, and every airport we add is going to have weekday variance.

---

## 33. Amex Centurion vs Amex Platinum — engine cannot distinguish

**Risk:** `hooks/useEntitlements.ts:31` maps `amex-platinum` (the only Amex
card in `data/creditCards.ts`) → `amex_centurion` (the engine channel).
That means anywhere a lounge has an `amex_centurion` channel, an Amex
Platinum holder qualifies. Real Amex Centurion is a much rarer, invite-only
card with broader access than Platinum. If a lounge is genuinely
Centurion-only (e.g., true Amex Centurion Rooms), we currently over-grant.

**Impact today:** OSL Premium Lounge (id=37) is marketed as
"Centurion access" per Amex; we treat it as Platinum-accessible via the
shared channel. Same shape at ARN Amex Lounge (Phase 22 id=30) and any
future amex_centurion lounge.

**Action needed:** Add `amex_platinum` (Platinum-only) as a distinct
`ChannelType` in `lib/engine/types.ts`, add a corresponding `amex-centurion`
card entry in `creditCards.ts`, and re-map:
  - `amex-platinum`  → `amex_platinum`
  - `amex-centurion` → `amex_centurion`
Then re-issue Centurion-only lounges with `amex_centurion` alone and
Platinum-inclusive lounges with both channels.

---

## 34. OSL — SAS lounges + Norwegian bank cards deferred

**Risk (a):** SAS operates its own lounges at OSL (Business, Gold, and
lounges under the SAS Go/Plus contract for Star Alliance status). Not
added because current data focus is Finnair-passenger-relevant lounges.
Same shape as ARN §24 and CPH §31.

**Risk (b):** Several Norwegian bank cards (DNB, Sparebank1 Elite) grant
OSL Lounge access as a card benefit. `data/creditCards.ts` has no
Norwegian bank cards, so these paths are not modeled. A Norwegian card
holder is currently under-served: the engine returns `paid_available` at
OSL Lounge when the card would actually grant `allowed`.

**Action needed (a):** Seed SAS lounges together with the remaining Star
Alliance carrier seeding from §19.

**Action needed (b):** Add DNB/Sparebank1 Elite entries to
`data/creditCards.ts` with the appropriate `loungeAccess` values. May
need a new `bank_partner` channel (see §30 for the Danske Bank parallel).

---

## 35. Aena Sala VIP opening hours unknown (PMI, ALC, VLC, LPA)

**Risk:** Aena's per-airport VIP Services pages do not publish reliable
opening hours for individual Sala VIP lounges. All six Phase 26 lounges
were seeded with `opening_hours = NULL`:
  - PMI Llevant (id=38), Mediterraneo (id=39), Valldemosa (id=40)
  - ALC Costa Blanca (id=41)
  - VLC Joan Olivert (id=42)
  - LPA Sala Galdos (id=43)

The engine cannot close them outside real operating hours and may return
`allowed` or `paid_available` early morning / late evening when the
lounges are actually shut.

**Action needed:** Verify per-airport hours (on-site, LoungePair
listings, or PP app), then
`UPDATE lounges SET opening_hours = ? WHERE id = ?` for each.

Same shape as §25 (ARN Pearl T2), §26 (AGP Sala VIP source conflict),
§28 (CPH Aviator lounges).

---

## 36. Carrier restriction seeding rule — Finnair (AY) always included at Finnair-network airports

**Risk (seeding rule, not a data gap):** oneworld.com's per-airport lounge
finder shows only the carriers currently operating at query time. Finnair
(AY) flies to leisure destinations (Canaries, partial Mediterranean) on a
winter schedule, so a summer snapshot omits AY. A naive "trust
oneworld.com" seed would drop AY from every lounge's carrier list, and
winter AY passengers would see incorrect "no access" results.

**Rule adopted from Phase 26 onward:**
> Any oneworld lounge at an airport in the Finnair route network
> (i.e., airports seeded from the Phase 20 Finnair-network table) MUST
> include AY in its `carrier_restriction` list, even if the current
> oneworld.com snapshot does not show AY.

**First-hand verification behind the rule:** User accessed LPA Sala Galdos
with Finnair Platinum, Winter 2026. Without the rule, LPA Sala Galdos
would have been seeded as `[BA, IB, AT]` and the user's known-good
access would have been reported as `paid_available`.

**Action needed:** Apply the same rule to all subsequent leisure-airport
batches. Do NOT need to re-verify per-lounge — the rule is derived from
oneworld membership + Finnair route inclusion, both of which are stable
facts. Re-check only if either changes (Finnair drops the route, or AY
leaves oneworld — neither expected).

**Confidence choice:** Phase 26 lounges use `confidence: 0.95` on the
alliance_status rule (vs 0.99 elsewhere) to reflect that the carrier list
is rule-derived rather than snapshot-verified.

---

## 37. Aena Sala VIP LK/DP channels — inferred from PP network

**Risk:** All six Phase 26 lounges have `lounge_key` (conf 0.85) and
`dragon_pass` (conf 0.8) channels inferred from PP-network membership,
same as AGP Sala VIP (§27) and HEL Plaza Premium (§14). Priority Pass
lists each lounge directly (conf 0.9), but LK/DP are inferred to also
work (same operator, same access model — Aena outsources Sala VIP
management to Petit Palace / Sodexo depending on the airport, and both
operators contract with all three networks).

**Action needed:** Confirm each lounge in the LoungeKey and DragonPass
apps. Update `source_url` on the respective rules to per-app deep links
once verified.

Track together with §14 and §27 if these need to be re-verified in bulk.

---

## 38. Greek Goldair / Skyserv lounge opening hours unknown

**Risk:** Neither Goldair Handling nor Skyserv publishes reliable per-
lounge opening hours on their operator sites. All six Phase 27 lounges
were seeded with `opening_hours = NULL`:
  - CFU Goldair Handling         (id=44)
  - HER Filoxenia                (id=45)
  - RHO Goldair Handling         (id=46)
  - JMK CIP by Goldair           (id=47)
  - SKG Manolis Andronikos       (id=48)
  - SKG Prima Vista              (id=49)

Same UX consequence as §35 (Aena Sala VIP): the engine cannot close
these outside real operating hours and may over-return `allowed` /
`paid_available` early morning or late evening. Impact is higher at
seasonal Greek islands (CFU, RHO, JMK) where lounges may open only for
scheduled departures.

**Action needed:** Verify per-lounge hours from LoungePair listings or
the PP app, then `UPDATE lounges SET opening_hours = ? WHERE id = ?`
for each. Track with §35 as a joint verification pass.

---

## 39. Greek lounges deferred — RHO Skyserv (closed) and JTR/KGS/CHQ (no oneworld)

**Risk (a):** RHO Skyserv Lounge is temporarily closed as of Phase 27
seeding. Not added; a would-be lounge id would sit unused. Adding it
later must be a NEW insert (not idempotent-skipped) once reopened.

**Risk (b):** Santorini (JTR), Kos (KGS), and Chania (CHQ) do not have a
oneworld lounge on oneworld.com's per-airport pages. They may have PP-
only lounges operated by Goldair or Skyserv (worth checking), but were
excluded from Phase 27 because the batch's model requires an oneworld
carrier list. Seeding them would require either a PP-only lounge shape
(no `alliance_status` channel — same as AGP Sala VIP in Phase 23) or
confirmation that a oneworld lounge exists.

**Action needed (a):** Watch skyserv.aero and prioritypass.com for RHO
Skyserv reopening. Seed as a new lounge under airport_id for RHO with
the standard Greek channel set once confirmed.

**Action needed (b):** Cross-check prioritypass.com for JTR / KGS / CHQ
lounge listings. If PP-lounges exist, seed them in a PP-only batch
following the AGP Sala VIP shape (no alliance_status channel — clean
negative case for oneworld access).

**Additional deferrals from §66 Case C oneworld batch (2026-07-26):**

  - **DCA** "American Airlines Admirals Club - Concourse D - Temporarily
    closed for renovations." — closed per oneworld.com. Watch for
    reopening.
  - **EZE** "LATAM VIP Lounge TEMPORARILY CLOSED" — closed per
    oneworld.com. Watch for reopening.

Both use the same §39 shape: oneworld.com lists the lounge in the
airport's results but with "temporarily closed" wording embedded in
the title. Not seeded; watch the source for reopening. MTY is a
separate case (broken lounge name in oneworld.com's DOM, not a
closure) — see §66 Case C rough-edges list.

---

## 40. Portuguese + Italian lounge opening hours unknown (Phase 28)

**Risk:** ANA (Portuguese airports) and the various Italian operators
(Aspire, local Sala VIP concessions) do not publish per-lounge opening
hours reliably on their operator sites. All 13 Phase 28 lounges seeded
with `opening_hours = NULL`:
  - LIS ANA Lounge (id=50), OPO ANA Lounge (id=51)
  - FAO CIP Lounge (id=52), FAO CIP Lounge Schengen (id=53)
  - FNC ANA Airport Lounge (id=54)
  - NAP Pearl Lounge (id=55), VCE Marco Polo (id=56), BLQ Prima Vista (id=57)
  - PSA Sala VIP Galilei (id=58), FLR Aeroporti VIP Club (id=59)
  - CTA Angelo D'Arrigo (id=60), VRN Catullo (id=61), TRN Piemonte (id=62)

Same shape as §35 (Aena Spain) and §38 (Goldair/Skyserv Greece). Higher
UX impact at smaller Italian regional airports (CTA, VRN, TRN) where
lounges may open only for scheduled long-haul departures rather than
throughout the day.

**Action needed:** Verify from LoungePair / PP app per lounge, then
`UPDATE lounges SET opening_hours = ? WHERE id = ?`. Consider one big
verification pass across §35 / §38 / §40 (25 lounges total).

---

## 41. FAO CIP Lounge zone assignment — assumption, not verified

**Risk:** FAO has two lounges seeded with different zone assignments:
  - `CIP Lounge`          (id=52, area='non_schengen')
  - `CIP Lounge Schengen` (id=53, area='schengen')

The non-Schengen assignment on id=52 is inferred from the existence of
a distinct `CIP Lounge Schengen` under the same operator — the base
name is presumed to serve the non-Schengen sector. Not verified against
FAO's terminal map or on-site signage.

**Impact if wrong:** A Finnair Schengen passenger from FAO would still
get correct behavior at CIP Lounge Schengen (id=53, `allowed`). But if
id=52 is actually Schengen too (i.e., two Schengen CIP lounges, not one
per zone), a Schengen passenger would see id=52 as
`physically_unreachable` when it should be `paid_available` or `allowed`.
The opposite mistake — if the split is real and id=52 is genuinely non-
Schengen — is the current seeded state and produces correct results.

**Action needed:** Verify on-site FAO or via LoungePair terminal map.
If both lounges are Schengen, `UPDATE lounges SET area='schengen'
WHERE id=52` and update the seed comment. Same shape as CPH Eventyr
non-Schengen assignment (Phase 24), which was verified against oneworld.com's
terminal-specific listing — FAO has no such per-terminal listing.

---

## 42. LIS Blue Lounge (PP-only) deferred

**Risk:** LIS has a Blue Lounge in Terminal 1 that is on the Priority
Pass network but NOT listed on oneworld.com (no oneworld carrier
access). Not seeded in Phase 28 because the batch's model requires an
`alliance_status` channel. A PP-card holder at LIS currently sees only
ANA Lounge (Schengen area, oneworld-listed) — they miss out on Blue
Lounge as an alternative PP option.

**Action needed:** Seed LIS Blue Lounge in a PP-only batch following
the AGP Sala VIP shape (Phase 23) — no `alliance_status` channel, just
`priority_pass` + `lounge_key` + `dragon_pass` + `paid`. May also apply
to Italian regional airports (need audit).

Track together with §39b (JTR/KGS/CHQ PP-only lounges) — the two form a
natural PP-only batch across leisure destinations.

---

## 43. Baltic + Central European lounge opening hours unknown (Phase 29)

**Risk:** Airport operator sites in the Baltics + CE region
(tallinn-airport.ee, riga-airport.com, vno.lt, lotnisko-chopina.pl,
budapestairport.com, prg.aero, lju-airport.si) do not publish per-lounge
opening hours reliably. All 15 Phase 29 lounges seeded with
`opening_hours = NULL`:
  - TLL (63), RIX (64), VNO (65)
  - WAW Etiuda (66), Fantazja (67), Preludium (68)
  - KRK (69), GDN (70)
  - PRG Erste Premier (71), Mastercard (72)
  - BUD SkyCourt (73), Platinum NS (74), Platinum Schengen (75), Plaza Premium NS (76)
  - LJU (77)

Same shape as §35 / §38 / §40. Cumulative lounges with unknown hours
across all four phases: 40 lounges (§35 six + §38 six + §40 thirteen +
§43 fifteen).

**Action needed:** Batch verification pass across all four sections at
once — same source list (LoungePair + PP app), same UPDATE shape. Worth
scripting as a single audit rather than per-phase.

---

## 44. PRG Menzies Aviation Lounge — temporarily closed

**Risk:** Menzies Aviation Lounge at PRG Terminal 2 (oneworld carrier
list: IB) is temporarily closed as of Phase 29 seeding. Not added.
Once reopened, an IB Sapphire passenger would gain a `allowed` path
that they currently do not have at PRG (Erste Premier is [AY,IB] but
they'd still route there via IB match — so the closure has no user-
visible impact today, only reduces choice).

**Action needed:** Watch prg.aero and PP app for reopening. Seed as a
new lounge at airport_id for PRG with the standard Greek/CE channel
set once confirmed. Same shape as §39a (RHO Skyserv).

---

## 45. Terminal-specific lounge filtering — engine gap

**Risk:** `lounges.terminal_id` exists in the schema and can point to a
row in the `terminals` table, but the current seeded state uses
`terminal_id = NULL` for every lounge from Phase 22 onward. The engine
accepts a `passengerTerminalId` EvalOption but has no code path that
filters lounges when both are set. Result: a passenger in PRG T1
sees both Erste Premier (T2) and Mastercard (T1) as `allowed` even
though they'd need to change terminals to reach Erste Premier.

Same issue affects (retroactively):
  - ARN Pearl T2 (28) vs Pearl C37 (29) — Terminal 2 vs Terminal 4
  - Phase 28 lounges with terminal notes in `location_description`
  - Phase 29 PRG Erste Premier (T2) + Mastercard (T1) — this batch's
    added case

**Action needed:** Two-step. (1) Add `passengerTerminalId` filter in
`lib/engine/evaluateLoungeAccess.ts`: if both `passenger.terminalId`
and `lounge.terminalId` are set and different, return
`physically_unreachable` with reason "different terminal". (2)
Backfill `terminal_id` on affected lounges via a migration keyed by
the terminals table (needs airport terminals seeded first — currently
none seeded in most airports).

Low priority — most users have IATA + no terminal in their query, so
`passengerTerminalId` is unset and the filter is a no-op.

---

## 46. Alliance-status confidence — direct vs §36-derived (adopted Phase 29)

**Standard (new in Phase 29, applies going forward):**

`alliance_status` rule `confidence` values:
  - **0.99** — carrier list matches the oneworld.com per-airport
             snapshot as-is at seeding time (direct listing).
  - **0.95** — carrier list is §36-derived: AY was added to the list
             because oneworld.com's seasonal snapshot omitted AY, and
             the airport is on Finnair's route network.

The 0.04 delta reflects that a rule-derived list is one step removed
from a primary-source verification. It is not (today) surfaced in the
UI — both fall inside the "high confidence" bucket. It is useful for
logging and for prioritizing re-verification passes (all 0.95 rules
should be re-checked when a winter snapshot becomes available).

**Not retro-applied.** Phase 26 (Spain), 27 (Greece), and 28 (Portugal +
Italy) seeded uniformly at 0.95 regardless of whether the source was
direct or §36-derived. Their alliance_status rules stay at 0.95. If the
distinction ever becomes UI-relevant, backfill those phases in one pass
by re-consulting the seeding rationale in each patch script's header
comment.

**Statistics as of Phase 29:**
  - Direct (0.99): 10 lounges
  - §36-derived (0.95): 5 lounges
  - Phase 26–28 legacy 0.95: 32 lounges

**Action needed:** None — this is a rule statement, not a data gap.
Reference from future batches when picking the alliance_status
confidence value.

---

## 47. Ryhmä-classification rule for lounge seeding (adopted Phase 30)

**Standard (new in Phase 30, applies to all future lounge seeding):**

Every lounge encountered during data collection falls into one of four
seeding shapes. The shape determines the channel structure and how §36
applies:

### Ryhmä 1 — Third-party operator lounge
- Operator hosts multiple oneworld carriers under contract (Aena Sala
  VIP, Goldair Handling, Skyserv, Aspire, Plaza Premium, Marhaba,
  Primeclass, "oneworld Lounge" branded, ANA Aeroportos, etc.)
- Seed shape: `carrier_specific` alliance_status channel with the
  listed carriers + PP/LK/DP + walk-in paid.
- §36 applies: add AY to carrier list if the airport is on Finnair's
  route network (confidence 0.95 for the alliance_status rule).
- Example phases: 26, 27, 28, 29.

### Ryhmä 2 — Airline-branded oneworld lounge
- Operated by a oneworld member airline as their brand (Cathay Pacific
  Lounge, American Airlines Admirals Club, AA Flagship Lounge, BA
  Lounge, JAL Sakura Lounge, Qantas Lounge, Alaska Lounge, Oman Air
  First & Business Class Lounge, Qatar Al Safwa / Al Mourjan).
- Seed shape: `all_alliance` alliance_status channel, sapphire+, NO
  carrier_restriction, confidence 0.99. No PP/paid channels (airline-
  brand lounges are not on PP network and don't do walk-in).
- §36 does NOT apply — the model doesn't use a carrier list.
- Access rule: any oneworld Sapphire+ pax on any oneworld-operated
  flight is `allowed`. Star Alliance / SkyTeam pax → `not_applicable`
  with reason "This is a oneworld lounge; your flight is on a
  different alliance carrier".
- Same shape as Phase 21 §17 fix (HEL Finnair Lounge).
- Introduced Phase 30.

### Ryhmä 3 — AMBIG contract lounge
- Operated by a NON-oneworld airline (SkyTeam Air France/KLM, former
  Star SAA, SkyTeam China Eastern, ex-oneworld Aer Lingus) that has a
  fixed contract to serve specific oneworld carrier(s).
- Seed shape: `carrier_specific` with the listed carriers verbatim,
  confidence 0.95 (contract-derived not snapshot-derived).
- §36 does NOT apply — the list is authoritative, not seasonal.
- Access rule: only pax on the listed carrier(s) qualify; others fall
  through to fallback (no walk-in either — contract lounges don't offer
  paid entry).
- Population: 7 lounges (CDG AF, DUB EI, FRA AF/KLM, MUC AF KLM, PVG
  SAA, PVG China Eastern x2).

### Ryhmä 4 — PP-only, no oneworld presence
- Airport has no oneworld lounge on oneworld.com, but a PP/LK/DP
  network lounge may exist (Aspire, Plaza Premium, small regional).
- Seed shape: PP + LK + DP + paid channels, no alliance_status.
- Example: AGP Sala VIP (Phase 23).
- Population as of Phase 30 scrape: 6 airports (BIQ, BOO, GZP, KKN,
  TOS, TRD).

### Classification rule (for future batches)

Given a lounge name from oneworld.com's per-airport listing:

  1. If the name contains a NON-oneworld airline brand token
     (Aer Lingus, Air France, KLM, China Eastern, SAA, Hawaiian) →
     Ryhmä 3.
  2. Else if the name contains a oneworld member airline brand token
     (American Airlines / Admirals Club / Flagship Lounge, British
     Airways, Cathay Pacific, Finnair, Iberia, Japan Airlines /
     Sakura, Malaysia Airlines, Qantas, Qatar Airways / Al Safwa /
     Al Mourjan, Royal Air Maroc, Royal Jordanian, SriLankan, Alaska
     Lounge, Fiji Airways, Oman Air) → Ryhmä 2.
  3. Else → Ryhmä 1 (third-party operator).
  4. If the airport has NO lounge on oneworld.com but has a PP-network
     lounge elsewhere → Ryhmä 4.

**Action needed:** None — this is a rule statement. Encoded in
`scripts/classify-lounges.ts` as a check-and-report utility. Run before
each new seeding batch to see the shape counts and any AMBIG cases.

---

## 48. NRT Cathay Pacific Lounge — temporarily closed

**Risk:** Cathay Pacific Lounge at NRT Terminal 2 (Level 2, Gate 71) is
temporarily closed as of Phase 31 seeding (oneworld.com listing shows
"Temporarily Closed" suffix on the lounge card). Not seeded. NRT
already has JAL First Class Lounge + JAL Sakura Domestic + JAL Sakura
International (all seeded Phase 31), so a Finnair Sapphire+ passenger
transiting NRT already has three oneworld lounge options. Impact of
the closure is limited to CX-loyal customers who prefer their own
brand.

**Action needed:** Watch oneworld.com/airport-lounge-results?location=NRT
and cathaypacific.com/lounges for reopening. Seed as a new lounge under
airport_id for NRT (id=112) with the standard Ryhmä 2 shape
(alliance_status/all_alliance/oneworld_sapphire/conf 0.99). Same shape
as §39a (RHO Skyserv) and §44 (PRG Menzies) deferrals.

---

## 51. Wording-based Ryhmä 1 vs Ryhmä 2 classification (adopted UK batch)

**Risk:** Original Ryhmä-classification (§47) uses lounge name patterns
(`classify-lounges.ts` RYHMA_2_TOKENS: "British Airways", "Cathay Pacific",
etc.). This is a proxy for the underlying rule; oneworld.com actually
distinguishes access via distinct wording on each lounge card:

  - **"Access for eligible customers traveling on ANY oneworld member
    airline"** → Ryhmä 2, `all_alliance` model. Carrier list on the page
    is informative, not gating.
  - **"Access for eligible customers traveling on THESE oneworld member
    airlines only"** → Ryhmä 1, `carrier_specific` model. Carrier list
    is authoritative (with §36 AY-lisäys where the snapshot is
    seasonally stale for Finnair).

Wording-based classification is objective, whereas name-based
classification depends on the operator's brand choices — a lounge could
be operated by a non-oneworld airline but still use the "ANY oneworld"
policy (e.g. a contract lounge), or a oneworld airline could restrict
their own lounge to specific partner carriers ("THESE only").

**Action needed:** Retroactive audit of prior batches (3a–3f) against
this wording criterion. Scrape output currently doesn't carry the exact
wording — needs re-scrape with `unmappedCarrierNames` + full access
policy text captured. Own project; do not block current batch. In UK
batch (LHR/MAN/EDI) this rule was applied from the outset because the
data was gathered manually with wording checked directly.

---

## 52. "First Class" + "Emerald Tier" wording — OR vs AND (adopted UK batch)

**Risk:** For "first class" lounges, oneworld.com's access rules use
two distinct wordings that map to different engine models:

  - **Both "First Class" AND "Emerald Tier" listed as separate lines**
    → OR condition. Emerald status ALONE grants access, even on a
    Business ticket. Model: `all_alliance` (or `carrier_specific`) with
    `min_alliance_tier = 'oneworld_emerald'`, **no cabin condition**.

  - **Only "First Class" listed, no "Emerald Tier" line** → AND-type
    (or ticket-based). Requires cabin=first, potentially plus named
    program cards (BA Concorde Room Cardholder, AA Concierge Key etc.).
    Model: `airline_own` with `conditions: cabin='first'`.

**Field-verified examples:**
  - LHR Cathay Pacific First Class Lounge, LHR AA International First
    Class Lounge — data shows both lines separately. User's
    first-hand: Finnair Platinum (Emerald) + Business ticket → in.
    Modeled as `all_alliance` + `oneworld_emerald`, no cabin.
  - LHR BA Concorde Room — data shows only "First Class" plus named
    BA program cards, no "Emerald Tier" line. User's first-hand:
    Finnair Platinum (Emerald) + Business ticket → DENIED. Modeled as
    `airline_own [BA,IB]` + `cabin='first'` (Phase #6 fix).

**Action needed for audit (own project, §51 audit):**
DB rows with `min_tier = oneworld_emerald` today:
  - DOH Al Safwa First Lounge (Batch 2c) — needs wording verification
  - DOH Qatar Airways Platinum Lounge - South (Batch 2c) — needs wording verification
  - HEL Finnair Platinum Wing (pre-baseline) — likely correct
  - JFK American Airlines Flagship Lounge (Phase 30) — likely correct
  - OSL OSL Premium Lounge (Phase 25) — carrier_specific + emerald, unusual
Named-program-only access paths (Concorde Room Cardholder, AA Concierge
Key) are not currently modeled and skipped as low-user-count edge cases.

---

## 53. QR Premium Lounge (LHR T4) — "Business Lite" not distinguished

**Risk:** LHR QR Premium Lounge oneworld.com access rule reads:
"First Class or Business Class **revenue** ticket (Business Lite not
eligible)". The engine's `passenger.cabin` field is one of `first`,
`business`, `economy` — it has no "Business Lite" distinction.

Modeled in the UK batch as `conditions: {op:'in', field:'passenger.cabin',
values:['first','business']}`. This is slightly permissive: a Business
Lite passenger (which the engine sees as `cabin: 'business'`) would be
allowed by the model but denied at the door.

**Action needed:** Fare-class-level modeling is out of scope for the
current engine. Impact narrow: Business Lite is a Qatar-specific fare
class, not commonly held by Finnair-network passengers via codeshare.
Revisit when the engine gains fare-basis awareness, or when a user
reports being denied entry.

---

## 54. BA Arrivals Lounge (LHR T5) — arrivals lounges not modeled

**Risk:** oneworld.com policy: "Arrivals lounges are excluded" from the
standard oneworld reciprocal access rules. The engine models departure
lounges only — a passenger enters a lounge at their departure airport,
not their arrival. Arrivals lounges are a departure-airport service for
the arriving passenger (post-flight shower/breakfast/etc.).

LHR BA T5 Arrivals Lounge exists physically (BA Club/Gold members
disembarking from a long-haul flight) but is not seeded in the UK batch.

**Action needed:** Engine would need a new lounge category
(e.g. `is_arrivals` boolean on the lounge row + logic to show it as an
arrival-side service). Not required for MVP. If added, seed:
  BA Arrivals Lounge (T5)  airline_own [BA,IB]  ~cabin~ any + arrival-side flag.

---

## 55. EDI No1 Lounge — temporarily closed (UK batch skip)

**Risk:** EDI No1 Lounge listed on oneworld.com but tagged "Temporarily
closed" as of UK batch seeding (2026-07). Not seeded. Same shape as
§39a (RHO Skyserv), §44 (PRG Menzies), §48 (NRT Cathay Pacific).

**Action needed:** Watch oneworld.com/airport-lounge-results?location=EDI
for reopening. Seed as Ryhmä 1 (standard 5-channel model, carrier list
per snapshot + §36 AY-lisäys if AY missing) under airport_id for EDI.

---

## 56. Program-specific tier access not modelable (adopted DOH audit)

**Risk:** oneworld.com lists some lounge access rules that reference
airline-program-specific tier names beyond the oneworld_ruby /
oneworld_sapphire / oneworld_emerald abstraction. Examples:

  - **DOH Al Safwa First Lounge** — "QR First Class ticket OR Business
    class ticket with **Privilege Club Platinum**" (QR's top status, ≈
    oneworld_emerald but NOT a synonym — Privilege Club has 4 tiers
    against oneworld's 3).
  - **LHR BA Concorde Room** — "First Class ticket OR **BA Executive
    Club Gold Guest List** OR **AA Concierge Key**" (both invitation-
    only tiers above regular Emerald).
  - **JFK AA Flagship First Dining** (not currently seeded) — Concierge
    Key or 3-class F ticket.

Engine models `AllianceTier` as a fixed enum of 8 values (oneworld ×3 +
star ×2 + skyteam ×2 + none). It cannot express "Privilege Club
Platinum" or "Gold Guest List" as distinct grades.

**Modeling choice for Al Safwa (DOH audit, this batch):**
The lounge is migrated to Concorde Room -style `airline_own [QR] +
conditions cabin='first'`, dropping the alternative "Business + Privilege
Club Platinum" path. This is deliberately CONSERVATIVE:
  - Prevents false positives (previously the model let any oneworld
    Emerald pax in on Business — wrong per audit)
  - Introduces false negatives: a genuine QR Privilege Club Platinum
    holder on a QR Business ticket is denied by the model, but would be
    admitted at the door.

**Action needed:** Long-term, the engine could grow either:
  (a) A per-airline `program_tier` field on `StatusContext` plus a
      condition operator like `{ op: 'program_tier_at_least',
      program: 'QR:PrivilegeClub', tier: 'Platinum' }`. Adds schema
      surface but stays declarative.
  (b) An `additional_requirement` exception on the lounge that a UI
      layer can surface as a "not fully modeled — check with staff"
      warning without gating engine output.

Neither is required for MVP. Same rationale as §54 (arrivals lounges):
the affected user population is small and the false-negative direction
is the safer error.

**Related model-audit results (§52 audit of DOH, 2026-07-23):**
  - DOH Al Safwa First Lounge — MIGRATED to airline_own + cabin=first
    per this section. Was: all_alliance + oneworld_emerald. Reason:
    data reads "First Class" without "Emerald Tier" line, QR-only.
  - DOH Qatar Airways Platinum Lounge - South — MODEL UNCHANGED
    (all_alliance + oneworld_emerald is correct per §52 OR-model;
    data lists "First Class" AND "Emerald Tier" separately + "ANY
    oneworld"). Added missing paid channel (Sapphire/Ruby purchasable
    access, oneworld_ruby minimum) — same Silver-gated shape as Phase
    21b HEL Finnair Lounge.

---

## 57. FRA JAL Sakura + QR Business Lounge — deleted as demo data (FRA review)

**Risk:** Two pre-baseline FRA lounges (JAL Sakura, Qatar Airways Business
Lounge) were seeded before the oneworld scrape / manual verification
process was in place. During the FRA review batch (2026-07), manual
oneworld.com lookup showed:

  - **JAL Sakura Lounge FRA (id=5)** — NOT on oneworld.com's FRA lounge
    list. JAL flies FRA (JL407/408 to NRT) but shares Lufthansa Senator
    Lounge under the LH codeshare arrangement. JAL has no dedicated
    lounge at FRA.
  - **Qatar Airways Business Lounge FRA (id=6)** — NOT on oneworld.com's
    FRA list. QR flies FRA but their oneworld customers access the
    third-party-operated **Priority Lounge (T2)** whose carrier list
    includes [QR] (seeded in this same batch as a new Ryhmä 1 entry).
    QR does not operate its own branded lounge at FRA (unlike hub DOH
    or outstations like BKK/SIN where they do).

Both entries were incorrect demo data. Impact of the wrong entries:
false positives — an AY Sapphire or QR/JL Sapphire pax would have been
told the (nonexistent) lounge was accessible, then find nothing there.

**Action taken:** Both lounges + their channels/rules deleted in FRA
review patch. Result verified by re-running oneworld.com FRA scrape
(now 4 real oneworld lounges seeded: Air France/KLM, Primeclass,
Priority Lounge T2, Priority Lounge T3).

**Rationale for deletion vs. keeping:** wrong data is worse than
missing data. The user directly confirmed both deletions after the
audit.

---

## 58. FRA T2 zone inference from gate numbers (partial certainty)

**Risk:** Unlike AMS (where the scrape data explicitly said "Non-Schengen
Area" and "Schengen Area"), FRA's manual data source did not label
lounge zones directly. Zone assignments in the FRA review batch were
INFERRED from gate numbers:

  - **Air France/KLM Lounge (T2, opposite D26-D27)** → non_schengen
    (D26-D27 are on the non-Schengen side of Terminal 2 per FRA
    airport map convention)
  - **Priority Lounge (T2, Gate E9)** → non_schengen (T2 E-gates are
    all non-Schengen international)
  - **Priority Lounge (T3, Level 5 Building 602)** → non_schengen
    (T3 opened as an international-focused terminal)
  - **Primeclass Lounge (T2, no specific gate)** → schengen (kept from
    pre-baseline id=22 assignment). Actual location within T2 is
    unclear from source data.

The inference is standard for FRA passengers but not authoritative.
Someone visiting on-site could confirm each lounge's actual zone.

**Impact of a wrong zone assignment:** the engine would show a lounge
as physically_unreachable to some passengers who could actually reach
it, or vice versa. False negatives (correctly-reachable lounge marked
unreachable) are the more common failure mode of a mislabeled zone.

**Action needed:** On-site confirmation for FRA lounges. Not blocking.
Alternative: if a user reports "showed unreachable but I was in the
same terminal", check the zone assignment first before assuming an
engine bug.

---

## 59. Ryhmä 4 (PP-only) airports — investigation results (CLOSED)

**Status:** Investigation complete (2026-07). All 6 airports deliberately
NOT seeded. This section closes the Ryhmä 4 open question.

**Scope:** classify-lounges.ts flagged 6 airports as Ryhmä 4 (PP-only,
no oneworld lounge on scrape): BIQ, BOO, GZP, KKN, TOS, TRD. Deferred
from all autonomous batches per user rule. Manual investigation confirms
none are seedable as oneworld or PP entries useful to the app's target
audience (Finnair-network passengers):

**(a) No lounge exists — nothing to seed:**
  - **BIQ** (Biarritz Pays Basque)
  - **BOO** (Bodø)
  - **KKN** (Kirkenes)
  - **TOS** (Tromsø)

  Small regional Norwegian / French airports without any lounge offering.

**(b) Closed lounge (§39-style deferral):**
  - **GZP** (Gazipaşa-Alanya) — CIP lounge closed. PP/DragonPass directs
    cardholders to AYT (Antalya, seeded Batch 3f). Same deferral shape
    as §39a (RHO Skyserv), §44 (PRG Menzies), §48 (NRT Cathay Pacific),
    §55 (EDI No1 Lounge). Watch for reopening.

**(c) Non-oneworld lounge exists but no value for target audience:**
  - **TRD** (Trondheim Værnes) — SAS Lounge (Terminal A domestic +
    Terminal B international). Access is Star Alliance / SkyTeam only
    (SAS Business/Plus, EuroBonus Gold/Diamond, SkyTeam Elite Plus, LH
    Group Business LH/LX/OS/SN, Widerøe Premium). **No oneworld member
    is listed for access.**

    Also NOT on Priority Pass network — accessible only via SAS's own
    app. So even the PP/paid fallback that GZP would have offered
    (if reopened) doesn't apply here.

    No value for Finnair-network customers — deliberately not seeded.

**Broader observation:** The Ryhmä 4 shorthand "PP-only, no oneworld"
combined three structurally distinct situations. Only (b) is potentially
seedable in the future, and only if it reopens. (a) and (c) are
permanent non-entries in the oneworld / PP scope of this app.

**Action needed:** None. This section serves as the record that Ryhmä 4
has been reviewed and consciously left unseeded. If the scrape re-runs
against a future oneworld.com refresh and re-flags one of these
airports, no re-investigation is needed unless the underlying situation
changes (BIQ/BOO/KKN/TOS get a new lounge, GZP reopens, TRD joins
oneworld — none of which is imminent).

---

## 60. DXB Marhaba Lounge — QR condition text not modeled

**Risk:** oneworld.com's DXB Marhaba Lounge page has:
  - **Carrier eligibility list:** [Finnair, Royal Air Maroc] → seeded as
    carrier_specific `[AY, AT]` sapphire.
  - **Additional text (not on the eligibility list):** "First and
    Business Class and oneworld Emerald customer... travelling on
    Qatar Airways operating flight."

The exact reading of the QR text is ambiguous without seeing the full
page context. Could be:
  - OR-list ("First/Business ticket OR Emerald status, on QR") — the
    standard oneworld reciprocal access wording restated for QR
  - AND-conjunction ("First/Business ticket AND Emerald status AND QR")
    — an unusually restrictive combination

**Chose the conservative direction:** [AY, AT] only, no QR path
modeled. Rationale:
  - Source data's carrier eligibility list is authoritative; text
    below is at best a repeat of standard rules
  - False positive (told access, denied at door) is worse UX than
    false negative (told no access, try anyway, find it works). Same
    reasoning as LHR BA Concorde Room migration (Phase #6) which was
    driven by a user's field report on the same UX failure.

**Action needed:** If a QR Emerald+Business/First user reports being
admitted at DXB Marhaba, add QR to the carrier list. Same category
as §53 (QR Business Lite), §56 (program-specific tiers).

---

## 61. DXB BA Lounge — overnight opening hours require engine verification

**Risk:** DXB BA Lounge (T1, Concourse D 1st floor) has two-shift
hours: **06:30–13:30 + 21:30–02:30**. The second range crosses
midnight, which is a distinct case from two ranges in the same
calendar day.

Schema-wise, `opening_hours` is a JSON blob with per-day arrays that
in principle can hold multiple time ranges. But `checkOpeningHours`
(engine layer) may or may not correctly handle a range where end < start
(implying "past midnight into next day").

**Action needed:** Verify `checkOpeningHours` behavior with a
midnight-crossing range before relying on it. If the engine truncates
at 24:00 or treats end < start as "closed all day", the model needs
either:
  (a) engine fix to interpret 21:30–02:30 as "21:30 today + 00:00–02:30
      tomorrow"
  (b) modeling workaround: split into two ranges "21:30–23:59 today"
      and "00:00–02:30 today"

Interim modeling for DXB BA Lounge in this batch: single range
"06:30–13:30" only (understates true availability). §61-TODO tracks
extending to the full two-shift once engine behavior is verified.

---

## 62. §52 AND-type wording — third field-verified case (JFK Chelsea)

**Third confirmed instance** of the §52 AND-type wording pattern
(cabin=first + named program cards, no Emerald Tier line). Chelsea
joins BA Concorde Room and DOH Al Safwa:

  - **LHR BA Concorde Room** (Phase #6) — field-verified 2026
  - **DOH Al Safwa First Lounge** (§52 audit) — audited via wording
  - **JFK BA/AA Chelsea Lounge** (JFK batch) — field-verified 2026:
    Finnair Platinum (Emerald) + AY Business → NOT admitted. Modeled
    as `airline_own [AA, BA] + cabin='first'`, no min_tier. Same
    program-tier abstraction gap as §56 (AA Concierge Key, BA Gold
    Guest List paths not modeled).

Contrast BA/AA Soho Lounge (same terminal, adjacent lounge): data
shows "First Class" AND "Emerald Tier" as separate lines → §52 OR-model
(all_alliance + emerald, no cabin). Field-verified: same user + same
trip, AY Platinum + Business → ADMITTED to Soho.

Chelsea and Soho are the cleanest side-by-side test of §52's two
models in the wild. Tests L1 (Chelsea denied) and L4/L5 (Soho: Sapphire
denied, Emerald allowed) preserve this distinction.

**Action needed:** None — modeled correctly. Update §56 if a fourth
case emerges (AA Flagship First Dining or similar).

---

## 63. Airport services default semantics — silence ≠ certainty

**Risk (fixed):** `evaluateAirportService.ts` previously conflated two
different states of ignorance with confident statements:

  - **No rules seeded for this service at this airport** → returned
    `not_offered_at_airport` with confidence 1.0. But 85 of 90 seeded
    airports had no fast track rules at all. Many of the unseeded ones
    (ARN, AMS, CPH, MUC, ZRH, MAN, BCN, HKG, SIN, DOH, ...) actually
    DO offer fast track in reality. Reporting "not offered" with
    confidence 1.0 was actively misleading. UI chip = "—" ("Not offered")
    was shown as a confident negative fact.

  - **Rules exist but no rule matches this passenger** → returned
    `denied` with confidence 0.95. But rules describe positive access
    paths, not exhaustive coverage. A rule requiring emerald doesn't
    DENY a sapphire pax — it's silent about them. The airport may
    still grant access via Amex/card providers, cabin, or other paths
    we haven't modeled. UI chip = "✗" ("Denied") was shown as an
    explicit deny when the reality was "we don't have a rule that
    covers this case".

Both were the same design flaw: engine treating silence as certainty.

**Fix:** Both default paths now return `not_enough_info` with
confidence 0.0. UI chip becomes "?" — honest signal that the engine
doesn't know. Only two paths still produce confident negatives:

  - `action='deny'` rule matches → `denied` (explicit deny rule fired)
  - `not_applicable` (e.g., departure time already passed)

Field-verified: user's ARN observation motivated this fix. ARN (and
84 other airports) previously showed "Fast Track: Not offered" with
confidence 1.0. Now shows "?" chip = "we don't have data".

**Impact:**
  - `not_offered_at_airport` status value retained in the enum for
    future use (e.g., seeding "airport confirmed to have no fast
    track"). Currently no rule uses it.
  - LHR `denied` case (rule [BA,IB] + AY-flight → previously "Denied"
    chip) now returns `not_enough_info` — much more accurate given LHR
    actually offers fast track for AY oneworld Sapphire pax on T3/T5.
    Whether to further expand the LHR carrier list is a separate
    tactical decision (not required for correctness).

**Action needed:**
  - Backfill fast track / priority_boarding rules to more airports as
    data becomes available. Own project. Current coverage 5/90 (5.6 %).
  - If a user reports "showed fast track as unknown but I know I qualify",
    the fix is to seed the missing rule, not tweak engine semantics.

**Post-fix carrier-restriction audit (2026-07):** 4 service rules had
non-empty `carrier_restriction` at time of §63 fix. Two paths:

  - **LHR id=4 fast_track_security + id=11 priority_boarding** — both
    were `[BA, IB]` only. oneworld.com says fast track/priority_boarding
    is a oneworld benefit available at Terminal 3 & 5. T5 = BA (covered),
    T3 = AA, CX, QF, JL, QR (previously excluded → misleading "?" chip
    for those pax). Expanded to `[BA, IB, AA, CX, QF, JL, QR]` with
    `notes = "Terminal 3 and Terminal 5 only"` for both rules
    (patch-lhr-services-carrier-expansion.ts).

  - **DXB id=7 fast_track_security `[EK]`** — NOT touched in the audit.
    EK is not a oneworld member; the [EK] restriction likely models
    Emirates' own fast track (their airline benefit for EK's own pax).
    Given §63 semantics, non-EK pax now correctly see "?" (not "✗").
    **Data verification needed:** does DXB have a SEPARATE oneworld fast
    track lane (e.g. T3 for oneworld carriers) that's not modeled?
    If yes, add a second rule with the oneworld carrier list. If not,
    the [EK] rule is correct.

  - **HEL id=12 `[AY]`** — narrow Finnair Silver + AY-flight rule. HEL
    has 7 other rules covering broader eligibility paths, so this
    narrow rule doesn't misrepresent — it's a specific benefit for a
    specific case. No change.

---

## 64. Airport service tier semantics — alliance-defined vs. local

**Risk (fixed):** §63 correctly turned "no rule matches" into
`not_enough_info`, but that swept up cases where a rule miss IS
authoritative. Specifically: oneworld defines fast_track_security,
priority_boarding, and priority_checkin as alliance-tier-level benefits
(Sapphire+ / Emerald). If a Ruby passenger fully qualifies on the LHR
fast_track rule's carrier list + alliance + everything else BUT is
below the required Sapphire tier, that's not "we don't know" — that's
oneworld's own policy saying "Ruby isn't eligible for fast track".

Under §63, this returned `not_enough_info` (chip "?"). Semantically
correct in the general case ("rule silent about Ruby"), but for
oneworld-defined benefits it's overly humble — Ruby passengers should
see the honest "✗ Denied" for fast track and know oneworld doesn't
give them the benefit.

**Fix:** Added `tier_semantics` column to `airport_service_rules`
(`'alliance_defined' | 'local'`, default `'local'`). Engine
introduces a §64 tier-hierarchy deny branch AFTER the allow loop but
BEFORE the default `not_enough_info` return. When an alliance_defined
rule's miss was ONLY due to tier (or no status), engine returns
`denied` with confidence 0.9. All other miss reasons (carrier,
alliance mismatch, condition failed, provider not present) still
return `not_enough_info` — those are silence, not denial.

**Classification (initial seed):**
  - `alliance_defined`: fast_track_security, priority_boarding,
    priority_checkin rules with `min_alliance_tier != NULL`
  - `local`: everything else, including priority_baggage rules and
    all card-provider / cabin-only rules

**Why lounges use `local` semantics (not alliance_defined):** lounge
access has many parallel paths (alliance tier, cards, walk-in, cabin).
A lounge rule requiring emerald doesn't declare "only emerald qualifies
here" — it declares "here is one path via emerald; other rules may
declare other paths". Tier miss on a lounge rule = silence, not deny.
Consistent with §56 (program-specific tiers can't be modeled) and §60
(QR condition ambiguity) reasoning.

**Why airport services can use alliance_defined:** the three service
types above are defined by alliance policy at the tier level.
oneworld's own policy is Sapphire+ → fast track. If we've seeded the
airport correctly, a tier miss under an alliance-defined rule IS
authoritative because the alliance itself defined the requirement.

**Not classified as alliance_defined (yet):**
  - `priority_baggage` — arguably also a oneworld Sapphire+ benefit but
    excluded from this initial rollout per user's explicit scope.
    Reclassify later if same-semantics behavior is desired.

**Cabin override:** the §64 tier-deny branch is skipped when
`passenger.cabin` is 'first' or 'business'. oneworld's own policy (and
most airlines' general policy) grants fast track and priority boarding
to premium-cabin passengers independent of frequent-flyer status. If
the airport hasn't seeded a separate cabin rule, denying a premium-
cabin pax on tier grounds would be a false-certain-negative — same
class of bug §63 fixed. Premium-cabin cases fall through to
not_enough_info instead.

**Behavior matrix (post-§64):**

| Miss reason | tier_semantics=alliance_defined + Economy cabin | + Business/First cabin | tier_semantics=local |
|---|---|---|---|
| tier_insufficient | denied conf 0.9 | not_enough_info (cabin override) | not_enough_info |
| no_status | denied conf 0.9 | not_enough_info (cabin override) | not_enough_info |
| wrong_alliance | not_enough_info | not_enough_info | not_enough_info |
| carrier_not_on_list | not_enough_info | not_enough_info | not_enough_info |
| condition_failed | not_enough_info | not_enough_info | not_enough_info |
| provider_not_present | not_enough_info | not_enough_info | not_enough_info |

**Empirical (LHR fast_track_security post-§64 + cabin override):**
  - AY Sapphire + Economy → allowed ✓
  - AY Ruby + Economy → denied ✗ (was "?" under §63 alone — G5 TODO cleared)
  - AY Ruby + Business → not_enough_info ? (cabin override — might qualify via cabin path)
  - No status + Economy → denied ✗ (authoritative)
  - No status + Business → not_enough_info ? (cabin override)
  - No status + First → not_enough_info ? (cabin override)
  - Sapphire + LH flight → not_enough_info ? (wrong alliance, not tier)
  - Amex-holder + LH flight → still allowed via card path (§64 doesn't
    fire because Amex rule is `local`)

**Migration:** `db/migrations/0002_wide_betty_ross.sql` adds the column
with default `local`. Backfill via `patch-seed-tier-semantics.ts`
promotes 12 existing rules to `alliance_defined`.

**Action needed:** None. Any new seed script must set tier_semantics
explicitly for airport service rules (default 'local' is safe but
under-specifies for oneworld/star/skyteam tier-based rules).

---

## 65. Finnair national exception + price field gap (verified 2026-07-24)

**Verified from primary source** (finnair.com/fi-fi, Finnair Plus
Silver benefits page, re-checked 2026-07-24):

**Finnair Priority-turvatarkastus (fast track) exception:**
> "Priority-turvatarkastus: Voit käyttää nopeampaa priority-turva­tarkastus­väylää
> kun matkustat Finnairin lennoilla (lipussa AY-tunnus ja lento Finnairin
> tai Norran liikennöimä). Etu on henkilökohtainen."

This confirms the HEL fast_track_security rule id=12 model:
`min_alliance_tier: 'oneworld_ruby'` + `carrier_restriction: ['AY']` +
`tier_semantics: 'alliance_defined'`. It's a **national exception** to
oneworld's default (Sapphire+ only for fast track) — Finnair extends
the benefit to Finnair Plus Silver holders (ruby-tier) on
AY-operated flights. The `[AY]` carrier restriction correctly narrows
this exception to AY-operated (or Norra codeshare AY-flight-number)
flights only; Silver holders on partner-operated flights don't get
the exception.

**Pattern implication:** other airlines may have similar
national-exception fast track rules (BA Executive Club Bronze at LHR?
IB Plus Plata at MAD?). If a user reports being admitted to fast
track with a below-Sapphire status, that's a candidate for another
`alliance_defined + oneworld_ruby + [carrier]` national exception.

**Finnair Lounge zone rule (verbatim, verified):**
> "Voit käyttää Schengen-puolen Finnair Loungea kun lentosi lähtee
> Schengen-alueelta, ja non-Schengen-puolen kun lentosi lähtee non-
> Schengen-alueelta."

Confirms Phase 17 zone logic: lounge id=2 (non_schengen) accessible
when passenger departs from HEL non-Schengen area; lounge id=3
(schengen) when Schengen. Zone assignment stands.

**Silver Finnair Lounge paid discount (rules 59, 60):**
> "30 EUR tai 4 800 Aviosta, vain AY-lennolla, ostettava ennakkoon
> digitaalisista kanavista."

Model captures: `min_alliance_tier: 'oneworld_ruby'` +
`carrier_restriction: ['AY']` + `provider: 'paid'` +
`tier_semantics: 'local'`. Ruby-tier gate ensures only Finnair Silver
holders (not walk-in strangers) can trigger the paid path.

**Gap: no price field in `lounge_access_rules`.** Schema has:
```
min_alliance_tier, carrier_restriction, priority, confidence,
conditions, source_url, verified_at
```

Missing: `price_cents`, `price_currency`, `alt_price_units`,
`alt_price_currency` (Avios). Currently the "30 EUR / 4,800 Avios"
information is captured only in `source_url` (link to Finnair.com page
that lists the price). Engine can return `paid_available` but can't
tell the user the price.

**Migration option (deferred):**
```sql
ALTER TABLE lounge_access_rules ADD COLUMN price_cents INTEGER;
ALTER TABLE lounge_access_rules ADD COLUMN price_currency TEXT;
ALTER TABLE lounge_access_rules ADD COLUMN alt_price_units INTEGER;   -- e.g. 4800 Avios
ALTER TABLE lounge_access_rules ADD COLUMN alt_price_currency TEXT;   -- e.g. 'Avios'
```

All nullable, additive. Engine's `paid_available` status would gain
optional `price` info returned to UI. Non-breaking to existing rules
(all `null`).

**Not blocking any current functionality.** Would improve UX: the chip
could say "Paid — 30 EUR" instead of just "Paid available". If/when
this is prioritized, the migration is one PR (add columns, extend
engine result, add UI display), and existing Finnair rules can be
backfilled from the source page.

**Also NOT modeled:** "ostettava ennakkoon digitaalisista kanavista"
(must be purchased in advance from digital channels). No way to
express in engine ("no walk-in at door"). Current model just returns
`paid_available` without indicating pre-purchase requirement.
Low priority — walk-in-at-door restrictions are already inconsistent
across the DB (many `provider='paid'` rules represent both walk-in
and pre-purchase without distinguishing).

**Action taken:** `verified_at` bumped to 2026-07-24 on all 5 affected
rules (lounge_access_rules 40, 41, 59, 60 + airport_service_rules 12)
via `db/patch-finnair-verified-refresh.ts`.

**Action needed:** none currently. Price field migration decision
belongs to a UX-driven PR when the "how much?" question becomes a
user complaint.

---

## 66. Centurion Lounge network — partial seeding + data gaps

**Seeded in this batch (2026-07-24):** 7 new Centurion Lounges (DFW,
LAX, MIA, SEA, HKG, MEL, HND) at airports already in the `airports`
table. Model: single `amex_centurion` channel, no PP/LK/DP (Centurion
is NOT on the Priority Pass network), no alliance channel. Also
renamed ARN's "American Express Lounge" → "The Centurion Lounge"
(same physical lounge, unified branding). JFK + LHR already had
Centurion pre-baseline.

**Raw network snapshot preserved:** `scripts/data/centurion-lounges.json`
(27 lounges across 26 IATAs, verified 2026-07-24 from
americanexpress.com/travel/centurion-lounge). Kept in-repo so a future
scope expansion doesn't have to re-source.

### Case A — In-scope data gaps (in airports table but unseeded)

Airports in the current scope (in `airports` table) with **zero
lounges** seeded, despite being real hubs with substantial lounge
infrastructure. Not a scope question — a **data gap in the current
scope**.

**Status (2026-07-24): all three original Case A airports now closed.**

  - **DEL** — seeded from existing scrape output (had been scraped
    but never processed into a batch). 1 oneworld lounge (Encalm
    Prive). See PR #27.
  - **TLV** — same root cause as DEL. 2 oneworld lounges (Dan Lounge,
    Layam Lounge Pier C). See PR #27.
  - **MAD** — different root cause: never in `scripts/iatas.txt`,
    so scraper never queried oneworld.com for it. Fixed by adding
    MAD to iatas.txt + re-running scraper + seeding. **2 oneworld
    lounges** (Iberia Premium Lounge Dalí T4 schengen + Iberia
    Premium Lounge Velázquez T4S non_schengen). NOT 5-6 as an
    earlier memory-based reconstruction had assumed — see rule
    below.

### 🚨 Rule (adopted 2026-07-24 after MAD reconstruction error)

**Alliance data must not be seeded without a scrape or manual verification
from the primary source.** During the MAD gap investigation, an earlier
reconstruction from memory produced a 6-lounge table with fictional
entries (Velázquez First / Cibeles / Puerta de Alcalá / Sala VIP
Cervantes / Sala VIP Miró). The actual scrape returned **2 lounges**
(Dalí + Velázquez, both "Premium Lounge" business-tier). None of the
6 memory entries matched exactly; several didn't exist at MAD at all
or were misnamed.

**Root cause of the reconstruction error:** memory-fabricated
"structural expectations" for a major hub (Iberia hub → surely has
First lounge + T1/T2 satellites + Aena Sala VIPs) filled the gap
without evidence.

**Rule going forward:**
  - Never propose a seed patch from memory. Always source-verify first.
  - If scraper hasn't run for an airport, add it to iatas.txt and run
    scraper — don't guess.
  - If oneworld.com's per-airport page hasn't been manually reviewed
    for the specific batch, defer classification.
  - Rule content differences from reconstruction to actual data are
    often 2-3x factor. Trust the primary source, not the mental model.

### Case B — Legitimate empty airports (no lounge in reality)

~35 airports in the table with zero lounges because they genuinely
don't have any. Documented sources:

### Case B — Legitimate empty airports (no lounge in reality)

~35 airports in the table with zero lounges because they genuinely
don't have any. Documented sources:

  - **Finnish regional** (15): IVL, JOE, JYV, KAJ, KAO, KEM, KOK,
    KTT, KUO, MHQ, OUL, RVN, TKU, TMP, VAA — small domestic
    Finnair-served airports without lounge offerings.
  - **Baltic small** (2): TAY (Tartu), KUN (Kaunas).
  - **§59 documented no-lounge / closed** (5): BOO, KKN, TOS, TRD,
    GZP (Ryhmä 4 investigation results).
  - **Small leisure / potential PP-only** (~13): ACE, TFN, DBV,
    SPU, CHQ, JTR, KGS, MJT, BOJ, SOF, PFO, MLA, TIA — seasonal or
    small operations, may or may not have PP lounges. If seeded,
    would be pure Ryhmä 4 (PP-only) entries.

  **Action:** none required. Verify individually if a specific
  user report indicates a lounge missed.

### Case C — Centurion scope expansion (seeded 2026-07-24)

**Status:** all 16 airports seeded as of 2026-07-24 via
`db/patch-centurion-case-c-16-airports.ts`. Airport rows come from
`sami/airports.csv` (OurAirports masterdata); lounge rows come from
`scripts/data/centurion-lounges.json`.

  - **US (11):** ATL, CLT, DCA, DEN, IAH, LAS, LGA, PHL, PHX, SFO, SLC
  - **International (5):** EZE, MEX, MTY, BOM, SYD (MEX has 2 lounges,
    T1 + T2 → 17 lounges total)

Per §67, every new airport row uses the default `lounge_coverage_status
= 'unverified'` — the UI honestly says "Centurion is here; other lounge
coverage is not verified." This is the key insight that made seeding
tractable: §66's original "a lonely Amex-lounge entry would look absurd"
concern assumed the pre-§67 UI where empty = "no lounges." Post-§67 the
empty-adjacent state is `?` with an honest disclaimer, not a confident
false negative.

The patch also added **MX** (Mexico) and **AR** (Argentina) to
`lib/airport-search/countryNames.ts` — first appearance of these ISO2
codes in the DB.

### Case C — oneworld layer seeded 2026-07-26

**Status:** oneworld-reciprocal lounges seeded for the 16 Case C airports
as of 2026-07-26 via `db/patch-oneworld-case-c-16-airports.ts`. Data
sourced strictly from `scripts/output/oneworld-lounges.json` (re-scraped
2026-07-26 with the `accessPolicyText` extension so §51 wording drives
classification — see next subsection). No memory-reconstructed rows.

**IATAs re-scraped (16, same set as the Centurion patch):**
ATL, CLT, DCA, DEN, IAH, LAS, LGA, PHL, PHX, SFO, SLC (US);
BOM, EZE, MEX, MTY, SYD (international).

**Per-IATA lounge yield from oneworld.com:**

  | IATA | Ryhmä 2 (any oneworld) | Ryhmä 1 (these only) | Deferred | Seeded |
  |------|-----------------------:|---------------------:|---------:|-------:|
  | ATL  | 1 | 1 | 0 | 2 |
  | CLT  | 3 | 0 | 0 | 3 |
  | DCA  | 2 | 0 | 1 (temp closed) | 2 |
  | DEN  | 1 | 1 | 0 | 2 |
  | IAH  | 1 | 2 | 0 | 3 |
  | LAS  | 0 | 1 | 0 | 1 |
  | LGA  | 1 | 0 | 0 | 1 |
  | PHL  | 4 | 1 | 0 | 5 |
  | PHX  | 3 | 1 | 0 | 4 |
  | SFO  | 4 | 0 | 0 | 4 |
  | SLC  | — | — | — | 0 (see below) |
  | BOM  | 0 | 1 | 0 | 1 |
  | EZE  | 1 | 1 | 1 (temp closed) | 2 |
  | MEX  | 1 | 0 | 0 | 1 |
  | MTY  | 0 | 0 | 1 (broken name) | 0 |
  | SYD  | 4 | 3 | 0 | 7 |
  | **Total** | **26** | **11** | **3** | **38** |

(One row is counted 26 + 11 = 37 in the wording column and 38 in the
seed column; the SYD "Qantas International First" row has an emerald-tier
label alone → same all_alliance model but §52 OR-tier at emerald, still
Ryhmä 2 in the seeded count.)

**SLC — no oneworld reciprocity (source-verified empty):** oneworld.com's
page rendered the `.lounges-list__no-results` placeholder for SLC
("No lounges were found for this airport. Please try a different
airport."). That is a positive source assertion of no oneworld reciprocal
lounge — not evidence of no lounges at all (SLC is a Delta hub with
major Sky Club presence + a Centurion that is already seeded). Per §67
`lounge_coverage_status` stays `unverified` — an oneworld-scrape hit
verifies oneworld reciprocity, not full inventory. Semantics of the
scrape are recorded here so the fact doesn't vanish when
`scripts/output/oneworld-lounges.json` is overwritten by the next
scrape run.

**§36 (AY-lisäys) — checked and does NOT apply to any of the 16:**
verification ran against the airports table seeded by
`db/seed-finnair-airports.ts` (Phase 20, 128 direct Finnair destinations
in 2026). None of the 16 Case C IATAs matches. **Caveat:** the check
covers direct Finnair-operated routes only. Codeshare-only presence
(AY flight numbers on QR / IB / AA operated flights, which could land
in BOM / EZE / MEX / etc.) is not in that dataset. If codeshare route
data is ever added to the repo, this §36 check must be re-run against
the 16 Case C IATAs — a codeshare hit would flip §36 for that airport
and require AY-lisäys on all Ryhmä 1 lounges there.

**§51 wording capture — scraper extended in this PR.** The `LoungeRecord`
type now carries `accessPolicyText`, populated from
`.lounge-details__airlines li.conditions`. Two canonical wordings drive
classification:

  - `Access for eligible customers traveling on any oneworld member airline.` → Ryhmä 2 (all_alliance)
  - `Access for eligible customers traveling on these oneworld member airlines only.` → Ryhmä 1 (carrier_specific)

Any other value (or `null`) means the DOM structure changed and the
lounge needs manual review before seeding. All 41 lounges in this batch
returned one of the two canonical values (0 nulls, 0 unknowns).

The wording extension closes the §51 audit gap for **all future** scrape
runs, not just this batch. Prior batches (3a–3f) predate the extension
and still classify by name via `classify-lounges.ts`. Re-scraping them
against the extended scraper is a separate cleanup PR — recorded in §51
as the retroactive audit.

### Case C — deliberate non-scope

**No non-oneworld lounges beyond Centurion were seeded.** ATL has a
large Delta Sky Club presence, DFW/PHX/CLT are AA hubs with additional
paid / operator lounges, SYD has multiple non-oneworld lounges, BOM has
airline-specific operator lounges. None of that data exists in a
primary source that lives in this repo:

  - Priority Pass / LoungeKey / DragonPass network listings for these
    16 airports have not been scraped. Adding PP / LK / DP channels to
    the seeded oneworld lounges would be an unsourced inference —
    forbidden under §66. Coverage stays `unverified` so the UI honestly
    signals "we know the oneworld + Centurion picture; other paths not
    verified."
  - **Star Alliance / SkyTeam** — permanently out of scope. No scraper
    exists for those alliances, no data source in the repo, and the
    app is oneworld/Finnair-centric.

### Case C — per-alliance coverage table (deliberate deferral)

If a Star Alliance or SkyTeam scraper is ever built (currently no plan
to), a **per-alliance coverage table** would be the correct data model —
something like `airport_alliance_coverage (airport_id, alliance, status,
verified_at, source_url)`. That would let the engine and UI express
partial coverage precisely ("oneworld verified, SkyTeam unverified")
rather than the current single `lounge_coverage_status` which is
alliance-agnostic. This has been considered and deliberately deferred:
one-alliance scraper does not justify the schema + engine + UI changes.
A future session encountering multi-alliance scraping should treat this
paragraph as the design decision to revisit, not to rediscover.

### Case C — remaining rough edges

  - Airport `name` and `city` fields are verbatim from OurAirports — no
    editorial cleanup. Two look awkward in UI:
      - **EZE**: city = "Buenos Aires (Ezeiza)"
      - **SYD**: city = "Sydney (Mascot)"
    Trusting the primary source over local cleanup per §66. If either
    is a UX problem, fix at the render layer, not by mutating rows.
  - No `terminals` rows created for these 16 airports. Centurion +
    oneworld rules are gate-agnostic (no terminal restriction on
    access), so this doesn't affect correctness. If terminal filtering
    (§45) becomes relevant for these IATAs, add terminals at that point.
  - **§39 deferrals from this batch (3 lounges), pending reopening or
    upstream fix:**
      - **DCA** "American Airlines Admirals Club - Concourse D -
        Temporarily closed for renovations." — closed. Watch for
        reopening on oneworld.com.
      - **EZE** "LATAM VIP Lounge TEMPORARILY CLOSED" — closed. LATAM
        left oneworld years ago but retains a physical lounge; oneworld.com
        still lists it as an eligible venue. Watch for reopening.
      - **MTY** — oneworld.com's page renders the lounge title element
        with only the text "MTY" (i.e., the IATA code, not a real
        lounge name). The scraper faithfully captures what's there.
        Not a scraper bug. Defer until oneworld.com publishes a real
        name for this Iberia-only lounge.

### Case C — HA (Hawaiian Airlines) mapping gap

Surfaced by SYD "The House" scrape: oneworld.com lists "Hawaiian
Airlines" as an eligible carrier, but `scrape-oneworld-lounges.ts`
CARRIER_MAP does not include HA even though Hawaiian recently joined
oneworld. The BA mapping in the same lounge is intact, so no lounge
was dropped from this batch — but any future lounge that lists HA as
its **only** eligible carrier would be miscategorized. Fix is a
one-line addition to CARRIER_MAP, but that changes the mapping for the
whole scrape output and needs a full re-scrape to observe downstream
effects. **Recorded as an explicit follow-up PR** — do not fix in a
lounge-seed batch.

---

## 67. Lounge coverage is a per-airport claim requiring a source

**Risk (fixed for Case B §66 subset):** the engine previously could not
distinguish two airports that both had zero lounge rows:

  - **(a) Verified no lounges in reality** — e.g. small regional
    airports with no lounge infrastructure at all (BOO, KKN, TOS per
    §59 (a)). Correct answer: "there is no lounge here."
  - **(b) Unseeded / unknown** — an airport in the `airports` table
    that no batch has covered yet, or a hub where lounges genuinely
    exist but we have not verified any of them (e.g. MAD before the
    2026-07-24 scrape). Correct answer: "we do not know."

Before this fix the UI treated both as an empty state with the same
message ("No lounge access found — try Priority Pass or airline
status"), which was silently wrong for (a) and misleading for (b).
Same class of bug as §63/§64 for airport services: silence conflated
with certainty.

**Fix:** three columns on `airports`:

  - `lounge_coverage_status` ('verified_none' | 'verified_seeded'
    | 'unverified', default 'unverified')
  - `coverage_verified_at` (ISO date, nullable)
  - `coverage_source_url` (nullable)

Engine returns a `coverage` object on `AirportEntitlements`; UI shows
a distinct empty-state message for `verified_none` (with source link)
vs `unverified + empty` (honest "we don't know yet") vs the normal
seeded case with lounges listed.

**Migration:** `db/migrations/0003_brown_cerebro.sql` adds the three
columns; every existing airport row backfills to `'unverified'`, so
no behavior changes without an explicit verification.

### The rule

> A change to `lounge_coverage_status` is a per-airport claim about
> the world. It requires a source with the same rigor as adding a
> lounge row per §66 — a scrape, a primary-source URL, or manual
> verification. Never mark an airport `verified_none` because
> "probably no lounges" or "seems unlikely" or by memory-reconstructed
> lists. If the source is not on hand, the row stays `unverified`.

This mirrors the §66 rule that alliance/lounge data must not be
seeded from memory. The empty-lounges list of an unverified airport
is honest ("we don't know"); a false `verified_none` is a confident
lie that ships in the UI.

### Invariants for coverage_source_url (§69 broadened, 2026-07-27)

`coverage_source_url` was originally used only when
`lounge_coverage_status = 'verified_none'` — the URL justified the
verified claim. §69 broadens the semantic to allow non-NULL values on
`unverified` rows too, so **future enforcement scripts must not assume
the older tighter invariant.** The current invariant matrix:

  | coverage_status  | coverage_source_url | Meaning |
  |---|---|---|
  | verified_none    | URL present         | Verified no facility; URL justifies the claim |
  | verified_none    | NULL                | **Inconsistent** — an enforcement script SHOULD flag this |
  | verified_seeded  | URL present         | Full coverage verified; URL is the source consulted |
  | verified_seeded  | NULL                | **Inconsistent** — should flag |
  | **unverified**   | **URL present**     | **§69 case: source consulted, facility not fully modeled (Ryhmä 4 airports).** NOT verified_none. |
  | unverified       | NULL                | Not investigated — the default. Valid, no flag. |

The old invariant "source_url present ⟺ verified_none" is **NO LONGER
TRUE**. The new invariant is:

> `source_url present ⟹ the airport was investigated against a
> primary source`, but the coverage_status can be any of the three
> values depending on what the source revealed.

An enforcement script written against the old invariant would
incorrectly flag §69's 4 Ryhmä 4 airports (KTT/OUL/TKU/VAA) as
malformed. It must use the new matrix above.

### Initial seeded rows (2026-07-24)

`db/patch-coverage-verified-none-59.ts` sets three airports to
`verified_none`, sourced from §59 (a):

  - **BOO** Bodø
  - **KKN** Kirkenes
  - **TOS** Tromsø

### Explicit non-verified_none exceptions from §59

Two airports appear in Case B (§66) alongside BOO/KKN/TOS but are
deliberately **not** `verified_none` — the underlying situation is
structurally different:

  - **GZP** Gazipaşa-Alanya — §59 (b): the CIP lounge is **closed**,
    not absent. Same §39-style deferral shape as RHO/PRG/NRT/EDI.
    The lounge infrastructure exists; it just isn't operating. Marking
    this `verified_none` would misrepresent the airport. Stays
    `unverified`; re-evaluate if the lounge reopens.
  - **TRD** Trondheim Værnes — §59 (c): a **SAS lounge exists** at
    both Terminal A and Terminal B, but access is Star Alliance /
    SkyTeam only and the lounge is not on Priority Pass. There is a
    working lounge; it is simply outside this app's oneworld-centric
    scope. Marking this `verified_none` would deny the existence of a
    real lounge. Stays `unverified`; re-evaluate if TRD ever gains
    oneworld carriers (not imminent).

### Deferred verification batches

The remaining Case B airports stay `unverified` until each batch has
per-airport source verification. **Do not bulk-flip.**

  - **Finnish regional (15)** — **DONE 2026-07-27 via §69**. IVL, JOE,
    JYV, KAJ, KAO, KEM, KOK, KUO, MHQ, RVN, TMP → `verified_none`.
    KTT, OUL, TKU, VAA → `unverified` + Finavia URL as `coverage_source_url`
    (Ryhmä 4 — Finavia lists a Lounges-category facility our schema does
    not yet model; see §69 for schema follow-up).
  - **Baltic small (2)**: TAY (Tartu), KUN (Kaunas). Verifiable via
    respective airport websites. Own batch.
  - **Small leisure / potential PP-only (13)**: ACE, TFN, DBV, SPU,
    CHQ, JTR, KGS, MJT, BOJ, SOF, PFO, MLA, TIA. §66 Case B lists
    these as "may or may not have PP lounges" — that phrasing is
    itself an admission that they are unverified. Do **not** promote
    any of these to `verified_none` from memory; only via
    per-airport primary-source check.

### `verified_seeded` — not yet used

The third enum value is retained for a future pass that asserts "this
airport's lounge coverage has been actively re-verified from primary
sources, and the seeded rows are complete for the current snapshot."
No rows use `verified_seeded` today. It exists so a later verification
sweep does not require another migration.

### Action needed

  - Per-batch verification passes for the Finnish regional, Baltic,
    and leisure buckets. Each batch is its own PR with per-airport
    source URLs.
  - If a user reports a lounge at any `verified_none` airport, treat
    it as a factual claim requiring investigation: the reporter has
    (weak) primary-source evidence and the current row's source may
    be stale or wrong. Do not simply flip the row — investigate
    first, then update with new source.

---

## 68. Fast track backfill — Finnair-source, oneworld branch (2026-07-26)

**Status:** 58 airports seeded via
`db/patch-fast-track-finnair-oneworld-backfill.ts`. All data sourced from
Finnair's priority-turvatarkastus page (user-pasted manual copy —
`internal-ref:finnair-priority-turvatarkastus/2026-07-26`; the live
`finnair.com/fi/fi/finnair-plus/tietoa-ohjelmasta/edut` URL returned 404
at fetch time, see §65 stale-URL TODO).

**BA fast-track policy captured as cross-validation** (not new seed
rules): BA source independently confirms oneworld Ruby → no fast track
(BA Executive Club Bronze explicitly excluded). Matches §64's tier-deny
behavior for `alliance_defined + oneworld_sapphire` rules — Ruby pax
under any of the new rules → §64 deny. Two independent sources
(Finnair table structure + BA policy text) now support the Sapphire+
threshold, no longer a single-source claim.

**QR source (Privilege Club tier table) has no fast-track-security line
at all** — only Priority check-in, Priority boarding, Priority baggage.
Silence per §63; no QR-specific seed rows added. QR pax fall through the
oneworld baseline rules (QR Gold = Sapphire, QR Platinum = Emerald).

### Access classes and rule shapes

Finnair's page uses an airport × pax-tier matrix. Four distinct
column-fill patterns emerged, each with a different rule set:

  **FULL (46 airports)** — all 8 columns ✓ (Business Flex/Classic/Saver,
  FP Platinum Lumo/Platinum/Gold/Silver, oneworld Emerald). Three rules
  per airport:

  ```
  Rule 1  oneworld_sapphire + [AY] + alliance_defined + allow  (pri 110)
          AY-scope status path. Cabin override for biz/first per §64.
  Rule 2  oneworld_emerald  + (no carrier) + alliance_defined + allow  (pri 90)
          oneworld reciprocity path — external oneworld Emerald pax on
          any oneworld carrier's flight. Corresponds to the "oneworld
          Emerald ✓" column on Finnair's table.
  Rule 3  cabin biz/first  + [AY] + local + allow  (pri 100)
          AY-scope cabin path — Business Flex/Classic/Saver on AY-op flight.
  ```

  **FULL_NO_FP_SILVER (1 airport: FLR)** — same 3 rules as FULL for
  this batch. FP Silver = oneworld_ruby; Rule 1 min_tier=sapphire fails
  → §64 tier deny → denied. Correct per Finnair source (FLR's Silver
  column is blank). **Critical §65 note:** when a later PR extends the
  §65-style Ruby [AY] alliance_defined allow to other AY-network
  airports, **FLR must be excluded** from that list — Finnair source
  denies FP Silver at FLR.

  **FULL_NO_OW_EMERALD (3 airports: GDN, TLL, WAW)** — Rules 1 + 3 only,
  no Rule 2. External oneworld Emerald pax on non-AY flights → carrier
  miss on Rule 1, no Rule 2 → `not_enough_info` (silent). **Deliberately
  NOT explicit deny:** Finnair source's blank Emerald column could mean
  "reality: no reciprocity" OR "Finnair does not know / does not
  publish." Silence per §63; without a second source (BA/QR) covering
  these airports, `?` is honest. Contrast with BIZ_ONLY where source
  structure IS an authoritative absence claim (see next).

  **BIZ_ONLY (8 airports: BKK, DOH, DXB, DUB, KIX, PVG, HND, YYZ)** —
  two rules per airport (Model α):

  ```
  Rule 3α  cabin biz/first  + [AY] + local + allow  (pri 100)
           Cabin path — Business Flex/Classic/Saver on AY-op flight.
  Rule 5α  oneworld_sapphire + [AY] + alliance_defined + deny  (pri 100)
           + condition: NOT cabin biz/first
           Explicit source-verified deny for status pax without a
           premium cabin ticket. Finnair source lists ONLY Business-
           ticket columns as ✓ at these airports; status columns are
           deliberately blank in the source structure — an authoritative
           absence, not silence.
  ```

  **Why α not β:** Model β (broader deny rule matching any non-cabin
  AY-pax without status filter) would additionally deny statukseton
  economy pax — matching Finnair source semantically ("only Business
  ticket admits") but fragilising future paid-add-on-service seeding.
  A future rule `provider='paid_priority_add_on' + [AY] + local + allow`
  would be blocked by DENY-broad because deny rules evaluate first in
  the engine regardless of allow-rule priority. Instead:

  - Model α gets Sapphire+ economy → denied ✓ (source-verified explicit
    absence of status admission).
  - Statukseton economy AY at BIZ_ONLY airport → `not_enough_info` (?),
    NOT `denied`.

  **This is a deliberate ali-varovaisuus.** Documented so it doesn't
  return as a surprise: the "?" preserves the possibility that a future
  paid-add-on rule admits statukseton pax without our current model
  blocking it. Full explicit-deny for statukseton needs either:
    (a) A negated-provider condition in the deny rule that excludes
        future paid providers (fragile — every new provider needs to be
        listed), or
    (b) Engine change: allow-rule priorities can override deny-rules for
        same-airport service-type combos.
  Neither is worth the complexity for this batch.

### HEL / LHR / JFK — not touched

Existing fast_track_security rules already cover Sapphire+ oneworld:

  - **HEL id=1**: `oneworld_sapphire, no carrier_restriction, alliance_defined` — broader than what Finnair source dictates but includes it. Home-hub reciprocity policy statement, not derived from this Finnair page.
  - **HEL id=12**: `oneworld_ruby, [AY], alliance_defined` — §65 Finnair Plus Silver national exception.
  - **LHR id=4**: `oneworld_sapphire, [BA,IB,AA,CX,QF,JL,QR,AY], alliance_defined, T3+T5 only` — expanded per §63 audit.
  - **JFK id=6**: `oneworld_sapphire, no carrier_restriction, alliance_defined`.

Adding another rule at HEL/LHR/JFK from this Finnair source would either duplicate (if broader) or over-restrict (if narrower with [AY]) — neither useful.

### LGW — deferred to own PR

BA source confirms fast track at LGW as a guaranteed BA hub. LGW is
**not** in the airports table. Adding it requires (a) airport row
insertion (OurAirports masterdata pattern per §66 Case C) and (b) a
BA-sourced fast-track rule (source_url = BA fast-track-security policy
page). Kept separate to preserve this PR's scope as Finnair-only.

### `source_url = internal-ref:...` (non-URL prefix)

All 163 seeded rows use `source_url =
"internal-ref:finnair-priority-turvatarkastus/2026-07-26"`. The
`internal-ref:` prefix is a deliberate non-URI-scheme marker so a future
enforcement script checking for `http://` / `https://` prefixes cannot
confuse a manual copy with a fetchable URL. This preserves §67's rigor:
`source_url IS NULL` still means "no source"; a URL-shaped value means
"fetchable source"; `internal-ref:...` means "recorded but not
fetchable" — three distinct states. **If an enforcement script is later
written, it must treat `internal-ref:` as a legitimate source (same as
`http://` / `https://`), not as a placeholder for a missing URL.**

### Behavior matrix (verified against dev server)

| Airport | Pax scenario | Result | Rule fired |
|---|---|---|---|
| ARN (FULL) | AY Gold eco AY-flight | allowed | Rule 1 |
| ARN (FULL) | AY Gold eco BA-flight | **denied** | Rule 2 tier miss + §64 |
| ARN (FULL) | AY statukseton biz AY-flight | allowed | Rule 3 |
| ARN (FULL) | AY statukseton eco AY-flight | **denied** | Rule 1 no_status + §64 |
| ARN (FULL) | BA Gold (Emerald) eco BA-flight | allowed | Rule 2 |
| ARN (FULL) | BA Silver (Sapphire) eco BA-flight | **denied** | Rule 2 tier miss + §64 |
| BKK (BIZ_ONLY) | AY Gold eco AY-flight | **denied** | Rule 5α |
| BKK (BIZ_ONLY) | AY Gold biz AY-flight | allowed | Rule 3α (5α cond fail) |
| BKK (BIZ_ONLY) | AY statukseton eco AY-flight | ? | (α deliberate) |
| GDN (NO_OW_EMERALD) | BA Gold (Emerald) eco BA-flight | ? | no Rule 2 |
| FLR (NO_FP_SILVER) | AY Silver eco AY-flight | **denied** | Rule 1 tier miss + §64 (source-align) |
| FLR (NO_FP_SILVER) | BA Gold eco BA-flight | allowed | Rule 2 |

### Known follow-up TODOs

- **§65-style Ruby [AY] extension** to other AY-network airports: when
  seeded, FLR must be excluded (per above).
- **LGW airport row + BA-sourced fast track rule** (BA-source-only PR).
- **§65 stale-URL fix**: `finnair.com/fi/fi/finnair-plus/tietoa-ohjelmasta/edut`
  returns 404 as of 2026-07-26. HEL id=12's `source_url` points there.
  Separate PR to update; not blocking.
- **Star Alliance / SkyTeam fast track branches**: permanently out of
  scope (no source, oneworld-centric app).
- **Reason-string clarity at FULL airports on non-AY carriers**: when
  a Sapphire+ AY-pax on non-AY carrier (e.g., codeshare BA-operated)
  hits ARN, the returned deny reason cites Rule 2's Emerald requirement
  rather than Rule 1's AY-carrier requirement. Correct model behavior
  (Rule 2 is the alliance_defined rule that fires §64), but user-facing
  reason string might be misleading. If UX feedback surfaces this,
  consider adding a per-rule reason override or a separate carrier-scope
  deny rule.
- **HA in scraper CARRIER_MAP** (from §66 Case C follow-up): still open.
- **Enforcement script recognition of `internal-ref:` prefix**: if any
  script checks source_url validity, it must treat `internal-ref:` as
  legitimate (not placeholder).
- **Pre-existing NULL source_url on 3 fast_track_security rows** (found
  during §68 QA, 2026-07-26): HEL id=2 (star_gold), HEL id=3
  (skyteam_elite_plus), FRA id=5 (star_gold). All three predate the
  source_url discipline established mid-project. Not this PR's fault
  (all §68 rows have `internal-ref:` sources), but exactly the kind of
  drift a source_url enforcement script would surface. Own PR — either
  find primary sources or delete if unsupported.

---

## 69. Finnish regional airports — coverage + fast-track (2026-07-27)

**Status:** 15 Finnish regional airports (all Finavia-listed regionals
except HEL + military Halli/Utti) coverage-verified and fast-track-
denied via `db/patch-finnish-regionals-coverage.ts`. Closes the Finnish
regional bucket of §67's "deferred verification batches".

**Sources per airport row:**

  - Finavia `/{airport}/services` page (per-airport URL) — access-model
    for each facility read from the "Opening hours" field, not from
    facility name. See rubric below.
  - Sami field-report: HEL is the **only** Finnish airport with a
    permanent fast track and international lounges. All 15 regionals
    get an explicit fast-track deny rule based on this + Finavia data.

### §69 access-model rubric (applied consistently)

Finavia categorizes facilities as `Lounges` or `VIP & Business` (or
`Café`, `Shop`, etc.). Historically these have been classified by name
(e.g. "VIP Lounge" → Ryhmä 4; "Meeting Room" → verified_none). §69
adopts a stricter rubric that avoids the §51-class bug of name-based
classification:

> Classify by **access model** (from the Opening hours field), not
> facility name.

Cases:

  - **`Lounges` category + drop-in access** (opening hours state
    terminal-hours *without* "by agreement" qualifier) → walk-in
    physical lounge → **Ryhmä 4**.
  - **`VIP & Business` category + "by agreement"** (in opening hours) →
    booking-based facility, not a drop-in lounge → **verified_none**
    (from a public passenger's perspective, this is not lounge access).
  - **`VIP & Business` category + drop-in** (no by-agreement qualifier)
    → drop-in VIP room. Not automatically Ryhmä 4 (that requires the
    `Lounges` category). Note the facility exists but stay conservative:
    if the facility isn't in `Lounges` category, don't upgrade the
    airport to Ryhmä 4 for it alone. Airport still classified by
    strongest `Lounges` signal.
  - **Cafés/Shops only** → verified_none (nothing to model as lounge).

### Notable case corrections vs name-based intuition

  - **TKU "VIP Lounge, Turku"** — Opening hours: "By agreement" → NOT
    drop-in. If TKU were classified by name alone, it would trigger
    Ryhmä 4 here — but the access model says booking-only, same as any
    Meeting Room. TKU's Ryhmä 4 status comes from **"Working area
    (Lounges category)"**, not this misleadingly-named VIP Lounge.
  - **KTT "VIP Room"** — Opening hours: "During terminal opening hours"
    (no by-agreement qualifier) → drop-in. Combined with **"Rocking
    chair (Lounges category)"** → KTT is Ryhmä 4.
  - **OUL Meeting Room Kaakkuri** — drop-in per opening hours but
    `VIP & Business` category, not `Lounges`. OUL's Ryhmä 4 status
    comes from **"Lounge: Hailuoto" (Lounges category, drop-in)**, not
    from this Meeting Room.

Rubric ensures TKU/OUL/KTT Ryhmä 4 status is anchored in an actual
`Lounges` category entry, not name-based inference. Meeting Rooms
(regardless of "VIP" wording in the name) are booking-only per opening
hours and don't grant lounge status.

### Coverage result (15 airports)

**verified_none (11)** — no drop-in lounge facility per Finavia:

  IVL, JOE, JYV, KAJ, KAO, KEM, KOK, KUO, MHQ, RVN, TMP

**Ryhmä 4 — unverified with source (4)** — Finavia lists a facility in
`Lounges` category (walk-in), but the schema does not currently model
this "local facility" type; deferred to future PR:

  KTT (VIP Room + Rocking chair), OUL (Lounge: Hailuoto),
  TKU (Working area), VAA (Lounge, Vaasa)

**RVN specifically verified** (user's explicit-attention request):
Rovaniemi is a charter-heavy Lapland hub, but Finavia's `/services`
page for RVN lists only cafés and restaurants — no VIP Room, no
Lounges-category entry, no seasonal charter lounge. Even after manual
sanity check on the raw page content, the result is honest
verified_none. If Sami-field-report ever contradicts (e.g., a charter
operator lounge exists on-site but isn't on Finavia's page), that
would be a separate source and the row can be updated.

### §67 coverage_source_url semantic — broadened

§67 originally documented `coverage_source_url` as "the justification
for the current coverage status" and stated that `unverified` rows
should have `NULL` here (an unverified assertion needs no source).
§69 broadens the semantic:

  | coverage_status  | coverage_source_url | Meaning |
  |---|---|---|
  | verified_none    | URL present         | Verified no facility; source justifies |
  | verified_none    | NULL                | (would be inconsistent — don't produce) |
  | verified_seeded  | URL present         | Full coverage verified; source consulted |
  | verified_seeded  | NULL                | (would be inconsistent — don't produce) |
  | **unverified**   | **URL present**     | **Investigated against a source, but not fully modeled — new §69 case (Ryhmä 4 airports)** |
  | unverified       | NULL                | Not investigated (default state) |

The new `unverified + URL` sub-state captures "we looked at the source
but our schema can't (yet) express what it says." This is honest —
neither a false verified claim nor a bare `?` shrug.

**UI implication:** dashboards showing an empty-lounge card should,
for Ryhmä 4 airports, show a "see Finavia for facility info" link
rather than the current bare `?`. **NOT wired in this PR** — pure
data change. Separate UI PR when Ryhmä 4 seeding is implemented.

### Fast track — absolute deny at all 15

Per Sami field-report: HEL is the only permanent Finnish fast track.
All 15 regionals get:

```
service_type       = 'fast_track_security'
action             = 'deny'
min_alliance_tier  = NULL
carrier_restriction = NULL
conditions         = NULL
tier_semantics     = 'local'
priority           = 100
notes              = 'No fast track at this airport (§69 Finavia + Sami field-report)'
source_url         = 'https://www.finavia.fi/en/airports/{slug}/services'
```

**Absolute** = engine's deny rules eval first (before allow rules) and
have no cabin override (unlike §64 tier-deny which does). Sapphire+
business pax at RVN → `denied` (matches source-verified absence). The
`local` tier_semantics is used because this is airport-level absence
(source-backed), not alliance-tier-defined absence.

### Deferred (own follow-up PRs)

  - **POR (Pori), SVL (Savonlinna), ENF (Enontekiö)** — not in
    `airports` table. Adding would require OurAirports airport-row
    seed (like §66 Case C pattern). Own tiny PR.
  - **SVL 404 investigation** — Finavia's `savonlinna/services` page
    returns HTTP 404 (all other airports return 200). The main
    `savonlinna` page returns 200 but with minimal content (no closure
    or charter language). Possible causes: (a) genuinely no services
    to list, (b) URL structure differs for SVL, (c) reduced operational
    status. **Investigate before treating SVL as ordinary airport row
    to seed** — a 404 is a signal, not just a missing page.
  - **Ryhmä 4 seeding schema** — modeling KTT/OUL/TKU/VAA's Lounges-
    category facilities requires either a new `local_facility` channel
    type or another kevyt mechanism. `paid` (Priority Pass etc.) does
    not describe them; `invitation` does not describe drop-in access.
    Own PR — schema decision + seed data.
  - **UI change for `unverified + source_url`** — show "see source"
    link instead of bare `?` for these airports.

### Ties to existing sections

  - **§67** — updates the "deferred verification batches" bullet:
    Finnish regional (15) → done. Baltic (2) and small leisure (13)
    remain unverified.
  - **§59** — RVN is not in §59 (which covers Ryhmä 4 investigation
    for BIQ/BOO/GZP/KKN/TOS/TRD only). §69 handles the broader
    Finnish regional Ryhmä 4 case for KTT/OUL/TKU/VAA.
  - **§66 Case B (b)** — the 15 Finnish regionals mentioned in Case B
    as "unverified, own future PR" are now this PR.
