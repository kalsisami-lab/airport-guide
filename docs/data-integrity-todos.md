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
