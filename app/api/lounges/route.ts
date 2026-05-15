import { NextRequest, NextResponse } from 'next/server';
import type { AILounge, AILoungeTier, LoungeNetwork, LoungeClass } from '@/lib/aiLounge';
import { CARRIER_ALLIANCE } from '@/data/allianceRules';
import { applyHardFilter } from '@/lib/loungeFilter';

interface LoungeQuery {
  airportIata: string;
  airportName: string;
  terminal?: string;
  airline?: string;
  operatingCarrierCode?: string;    // IATA 2-letter code, e.g. "AY"
  cardName?: string;
  cardNetworks?: string[];
  statusName?: string;
  statusAccessMethods?: string[];   // raw IDs for hard filtering server-side
  allianceTier?: string;            // human-readable label for the AI prompt
  departureZone?: 'schengen' | 'non-schengen' | 'international';
  destination?: string;
  gate?: string;
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const VALID_TIERS    = new Set<AILoungeTier>(['ultra-premium', 'premium', 'standard']);
const VALID_NETWORKS = new Set<LoungeNetwork>([
  'oneworld', 'star-alliance', 'skyteam',
  'priority-pass', 'lounge-key', 'dragon-pass',
  'amex-centurion', 'airline-own', 'independent',
]);
const VALID_CLASSES  = new Set<LoungeClass>(['first', 'business', 'standard']);

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

function buildPrompt(q: LoungeQuery): string {
  const creds: string[] = [];
  if (q.cardName) {
    creds.push(`• Credit card: ${q.cardName}`);
    if (q.cardNetworks?.length) {
      const networkLabels: Record<string, string> = {
        'priority-pass': 'Priority Pass',
        'lounge-key':    'LoungeKey',
        'dragon-pass':   'DragonPass',
        'amex-platinum': 'Amex Centurion/Platinum',
      };
      const nets = q.cardNetworks.map((n) => networkLabels[n] ?? n).join(', ');
      creds.push(`  → Lounge networks: ${nets}`);
    }
  }
  if (q.statusName) {
    creds.push(`• Airline status: ${q.statusName}`);
    if (q.allianceTier) creds.push(`  → Alliance tier: ${q.allianceTier}`);
  }

  const carrierCode = q.operatingCarrierCode?.toUpperCase();
  const carrierAlliance = carrierCode ? (CARRIER_ALLIANCE[carrierCode] ?? null) : null;
  const carrierNote = carrierCode
    ? `${q.airline ?? carrierCode} (IATA: ${carrierCode})${carrierAlliance ? ` — ${carrierAlliance} member` : ' — NOT an alliance member'}`
    : 'not specified (assume user is flying an appropriate carrier for their status)';

  const zoneNote =
    q.departureZone === 'schengen'
      ? 'Departing within Schengen Area — only include Schengen-side lounges.'
      : q.departureZone === 'non-schengen'
      ? 'Departing outside Schengen Area — only include Non-Schengen/International-side lounges.'
      : 'Show all accessible airside lounges.';

  return `You are an expert airport lounge consultant with up-to-date knowledge of global airport lounges, access policies, and alliance rules (2024-2025).

USER SITUATION
• Airport: ${q.airportName} (${q.airportIata})${q.terminal ? ` — ${q.terminal}` : ''}
• Operating carrier: ${carrierNote}
${q.destination ? `• Destination: ${q.destination}` : ''}
${q.gate ? `• Departure gate: ${q.gate}` : ''}
• Zone: ${zoneNote}

USER CREDENTIALS
${creds.length ? creds.join('\n') : '• None provided'}

ALLIANCE ACCESS RULES — apply STRICTLY:
${carrierAlliance
  ? `⚠ User flies ${carrierAlliance}. They may ONLY access ${carrierAlliance} alliance lounges via status. Do NOT list Star Alliance, SkyTeam, or other alliance lounges for status access.`
  : '• Operating carrier unknown — include alliance lounges only when user holds clear qualifying status.'}
• oneworld Emerald  → First Class + Business Class lounges of ANY oneworld carrier
• oneworld Sapphire → Business Class lounges of ANY oneworld carrier ONLY (NOT First)
• Star Alliance Gold → Business / Senator lounges of ANY Star Alliance carrier ONLY
• SkyTeam Elite Plus → Business lounges of ANY SkyTeam carrier ONLY
• Priority Pass / LoungeKey / DragonPass → independent partner lounges in that network

REQUIRED JSON FIELDS — fill accurately:
"network" (machine-readable access path for this user):
  "oneworld"      → user accesses via oneworld Emerald or Sapphire status
  "star-alliance" → user accesses via Star Alliance Gold status
  "skyteam"       → user accesses via SkyTeam Elite Plus status
  "priority-pass" → lounge accepts Priority Pass AND user has it
  "lounge-key"    → lounge accepts LoungeKey AND user has it
  "dragon-pass"   → lounge accepts DragonPass AND user has it
  "amex-centurion"→ Amex Platinum / Centurion lounge
  "airline-own"   → carrier's own lounge for their passengers / cabin class
  "independent"   → pay lounge, hotel lounge, or other

"loungeClass" (the lounge tier, used to validate Emerald vs Sapphire access):
  "first"    → First Class / Flagship / Premium First lounge
  "business" → Business Class / Gold / Senator lounge
  "standard" → Standard / general access lounge

TASK
List ALL lounges at ${q.airportIata} this user can access right now.
Be accurate and conservative — only list lounges where access is certain or very likely.
${q.gate ? `Estimate walking time from Gate ${q.gate} for each lounge.` : ''}

Return ONLY valid JSON (no markdown, no explanation):
{
  "lounges": [
    {
      "id": "kebab-slug-unique",
      "name": "Official full lounge name",
      "location": "Terminal, Level, Wing or area",
      "accessMethod": "Human-readable: which credential grants this user entry",
      "hours": "Daily HH:MM–HH:MM or 24h or check at lounge",
      "amenities": ["up to 5 key amenities"],
      "tier": "ultra-premium OR premium OR standard",
      "network": "oneworld|star-alliance|skyteam|priority-pass|lounge-key|dragon-pass|amex-centurion|airline-own|independent",
      "loungeClass": "first|business|standard",
      "walkingInfo": "~X min from Gate Y (only if gate was provided, else omit)"
    }
  ],
  "notes": "Any important caveats or conditions"
}`;
}

function buildVerifyPrompt(q: LoungeQuery, initialJson: string): string {
  const carrierCode = q.operatingCarrierCode?.toUpperCase();
  const carrierAlliance = carrierCode ? (CARRIER_ALLIANCE[carrierCode] ?? null) : null;

  return `You are a strict airport lounge access validator.

Review this lounge list for a user at ${q.airportName} (${q.airportIata}):
${initialJson}

Operating carrier: ${q.airline ?? 'unknown'}${carrierCode ? ` (IATA: ${carrierCode})` : ''}${carrierAlliance ? ` — ${carrierAlliance}` : ''}
User credentials: ${[q.cardName, q.statusName, q.allianceTier].filter(Boolean).join(' / ') || 'none'}

VERIFY each lounge entry:
1. Does this lounge ACTUALLY exist and operate at ${q.airportIata}?
2. Is "network" correct? Alliance lounges require flying the matching alliance carrier.
3. Is "loungeClass" correct? (first/business/standard)
4. Is the access method accurate for this user's specific credentials?
5. Are any qualifying lounges missing?

REMOVE entries where access is incorrect.
FIX name, location, network, loungeClass, or accessMethod errors.
ADD any clearly missing lounges.

Return the corrected JSON in the EXACT same schema with no markdown:
{
  "lounges": [...],
  "notes": "Verification complete. Changes: ..."
}`;
}

function parseAIResponse(raw: string): { lounges?: AILounge[]; notes?: string } | null {
  try {
    return JSON.parse(raw) as { lounges?: AILounge[]; notes?: string };
  } catch {
    return null;
  }
}

function normalizeLounges(raw: AILounge[]): AILounge[] {
  return raw.map((l, i) => ({
    ...l,
    id:          l.id || `lounge-${i}`,
    tier:        VALID_TIERS.has(l.tier as AILoungeTier)    ? l.tier        : 'standard' as AILoungeTier,
    network:     VALID_NETWORKS.has(l.network as LoungeNetwork) ? l.network : 'independent' as LoungeNetwork,
    loungeClass: VALID_CLASSES.has(l.loungeClass as LoungeClass) ? l.loungeClass : 'business' as LoungeClass,
  }));
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured on server' }, { status: 503 });
  }

  let body: LoungeQuery;
  try {
    body = await req.json() as LoungeQuery;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.airportIata) {
    return NextResponse.json({ error: 'airportIata is required' }, { status: 400 });
  }

  try {
    // Step 1 — AI generates initial lounge list
    const step1Raw = await callGemini(buildPrompt(body), apiKey);
    const step1 = parseAIResponse(step1Raw);

    // Step 2 — AI verification pass
    const step2Raw = await callGemini(buildVerifyPrompt(body, step1Raw), apiKey);
    const step2 = parseAIResponse(step2Raw);

    const rawLounges = normalizeLounges(
      step2?.lounges ?? step1?.lounges ?? [],
    );

    // Step 3 — Hard alliance filter (deterministic, overrides AI)
    const lounges = applyHardFilter(rawLounges, {
      operatingCarrierCode: body.operatingCarrierCode ?? null,
      statusAccessMethods:  body.statusAccessMethods  ?? [],
      cardNetworks:         body.cardNetworks          ?? [],
    });

    return NextResponse.json({ lounges, notes: step2?.notes ?? step1?.notes });
  } catch (err) {
    console.error('AI lounge lookup failed:', err);
    return NextResponse.json(
      { error: 'AI lookup failed — please try again', lounges: [] },
      { status: 500 },
    );
  }
}
