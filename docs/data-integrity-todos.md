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
