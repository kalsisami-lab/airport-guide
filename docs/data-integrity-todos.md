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

## 2. Seed missing oneworld carriers into the airlines table

**Risk:** The OP Lounge by Aspire oneworld rule (channel id=50, `alliance_access = 'all_alliance'`)
grants access based on `passenger.operatingAlliance === 'oneworld'`, which is derived at runtime
from the `airlines` table join. Currently seeded oneworld members: `AA, AY, BA, IB, JL, QR`.
Passengers flying on unseeded carriers receive `null` alliance → denied even if entitled.

**Unseeded oneworld members** (absent from `airlines` table as of 2026-06-15):
CX (Cathay Pacific), MH (Malaysia Airlines), QF (Qantas), RJ (Royal Jordanian),
AT (Royal Air Maroc), UL (SriLankan Airlines), WY (Oman Air).

**Action needed:** Seed missing carriers into `airlines` with `alliance_id = 1` (oneworld).
No rule change needed — the `all_alliance` mechanism picks them up automatically.

---

## 3. Verify Finnair-only access at OP Lounge — possible sub-Sapphire rule

**Risk:** Finavia's description says "Finnair vain Finnairin lennoilla" (Finnair [passengers]
only on Finnair flights), which could imply a Finnair-specific rule below the oneworld_sapphire
tier — e.g., Finnair Plus Silver (oneworld_ruby) on AY flights. Not modelled.

**Action needed:** Confirm via OP or Finavia whether Finnair Plus Silver (or any tier below
Sapphire) grants access on AY-operated flights. If yes, add a second `alliance_status` rule
with `min_alliance_tier = 'oneworld_ruby'` and `carrier_restriction = ['AY']`.

---

## 4. Star Alliance Gold access at HEL Aspire Lounges

**Risk:** Aspire Lounge by Gate 13 (id=25) and Gate 27 (id=26) at HEL may grant
Star Alliance Gold access through Plaza Premium's network agreements. Not verified:
Star Alliance lounge finder, Finavia, and Plaza Premium were unreachable during Phase 12.

**Action needed:** Verify via Star Alliance lounge finder
(`https://www.staralliance.com/en/lounge-finder`) or Plaza Premium directly before
adding an `alliance_status` channel with `min_alliance_tier = 'star_gold'`.

---

## 5. HEL Plaza Premium Lounge — not yet added

**Risk:** Plaza Premium operates a lounge at Helsinki Airport that is distinct from
the two Aspire Lounge by Plaza Premium entries (Gate 13 and Gate 27). It is not
currently in the database.

**Action needed:** Confirm location, opening hours, access channels
(Priority Pass, LoungeKey, DragonPass, paid), and area (schengen/non_schengen)
via Finavia or Plaza Premium official sources before adding.

---

## 6. Schengen zone for HEL Aspire Lounges — low-confidence Wikipedia source

**Risk:** HEL Aspire Lounge by Gate 13 (id=25) and Gate 27 (id=26) are set to
`area = 'schengen'` at confidence 0.8, based on Wikipedia ("gates 5–36 = Schengen flights").
Finavia's official site was unreachable for cross-check during Phase 12.

**Action needed:** Verify via Finavia (`https://www.finavia.fi/en/airports/helsinki-airport`)
or airport map before increasing confidence or relying on zone filtering for these lounges.

---

## 7. Other "by Aspire" and bank lounges in Finland — data gap

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

## 8. 718/720 lounge_access_rules without source_url

Most rules were seeded without `source_url` or `verified_at`. This is not an immediate
correctness risk but means rules cannot be re-verified or traced to their origin.

**Recommended approach:** Prioritise adding sources for:
1. Rules that are currently granting access (`allowed`/`likely_allowed`) to high-traffic routes
2. Any `alliance_status` rule with `min_alliance_tier` in the top 2 tiers per alliance
   (i.e., emerald, star_gold, elite_plus) — wrong data here has the highest impact

No bulk fix recommended — source verification requires per-rule human review.
