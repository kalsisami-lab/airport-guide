import { NextRequest, NextResponse } from 'next/server';
import type { AILounge, AILoungeTier, LoungeNetwork, LoungeClass } from '@/lib/aiLounge';
import { CARRIER_ALLIANCE, STATUS_ALLIANCE_TIER } from '@/data/allianceRules';
import { applyHardFilter } from '@/lib/loungeFilter';
import { LOUNGE_DATABASE, type StaticLounge } from '@/data/loungesData';

interface LoungeQuery {
  airportIata: string;
  airportName: string;
  terminal?: string;
  airline?: string;
  operatingCarrierCode?: string;
  cardName?: string;
  cardNetworks?: string[];
  statusName?: string;
  statusAccessMethods?: string[];
  allianceTier?: string;
  departureZone?: 'schengen' | 'non-schengen' | 'international';
  destination?: string;
  gate?: string;
}

// ─── Static lounge resolver ───────────────────────────────────────────────────

/** Walk time string from gate prefix matching. Longest prefix wins. */
function walkingInfo(gate: string | undefined, lounge: StaticLounge): string | undefined {
  if (!gate || !lounge.gateProximity?.length) return undefined;
  const g = gate.toUpperCase();
  const sorted = [...lounge.gateProximity].sort((a, b) => b.prefix.length - a.prefix.length);
  const match = sorted.find((p) => g.startsWith(p.prefix.toUpperCase()));
  return match ? `~${match.minutes} min from Gate ${gate}` : undefined;
}

/** Human-readable access method label for a resolved network. */
function accessMethodLabel(
  network: LoungeNetwork,
  statusAccessMethods: string[],
  statusName?: string,
): string {
  switch (network) {
    case 'oneworld': {
      const entry = statusAccessMethods.map((m) => STATUS_ALLIANCE_TIER[m]).find(
        (e) => e?.alliance === 'oneworld',
      );
      if (!entry) return 'oneworld status';
      const tier = entry.tier.charAt(0).toUpperCase() + entry.tier.slice(1);
      return `oneworld ${tier}`;
    }
    case 'star-alliance': return 'Star Alliance Gold';
    case 'skyteam':       return 'SkyTeam Elite Plus';
    case 'priority-pass': return 'Priority Pass';
    case 'lounge-key':    return 'LoungeKey';
    case 'dragon-pass':   return 'DragonPass';
    case 'amex-centurion':return 'Amex Platinum';
    case 'airline-own':   return statusName ?? 'Airline status';
    case 'independent':   return 'Paid access';
    default:              return 'Access granted';
  }
}

/** Try each network on a lounge and return the first one the user qualifies for. */
function resolveNetwork(
  lounge: StaticLounge,
  operatingCarrierCode: string | null,
  statusAccessMethods: string[],
  cardNetworks: string[],
): LoungeNetwork | null {
  for (const network of lounge.networks) {
    const candidate: AILounge = {
      id: lounge.id,
      name: lounge.name,
      location: lounge.location,
      accessMethod: '',
      hours: lounge.hours,
      amenities: lounge.amenities,
      tier: lounge.tier,
      network,
      loungeClass: lounge.loungeClass,
    };
    const passed = applyHardFilter([candidate], {
      operatingCarrierCode,
      statusAccessMethods,
      cardNetworks,
    });
    if (passed.length > 0) return network;
  }
  return null;
}

function resolveStaticLounges(
  statics: StaticLounge[],
  q: LoungeQuery,
): AILounge[] {
  const zone = q.departureZone ?? 'international';
  const carrierCode = q.operatingCarrierCode ?? null;
  const statusMethods = q.statusAccessMethods ?? [];
  const cardNetworks = q.cardNetworks ?? [];

  const results: AILounge[] = [];

  for (const lounge of statics) {
    // Zone filter: 'all' and 'international' pass any zone
    if (
      lounge.area !== 'all' &&
      lounge.area !== 'international' &&
      lounge.area !== zone
    ) continue;

    const network = resolveNetwork(lounge, carrierCode, statusMethods, cardNetworks);
    if (!network) continue;

    results.push({
      id:           lounge.id,
      name:         lounge.name,
      location:     lounge.location,
      accessMethod: accessMethodLabel(network, statusMethods, q.statusName),
      hours:        lounge.hours,
      amenities:    lounge.amenities,
      tier:         lounge.tier,
      network,
      loungeClass:  lounge.loungeClass,
      walkingInfo:  walkingInfo(q.gate, lounge),
    });
  }

  // Sort: ultra-premium first, then premium, then standard
  const order: Record<AILoungeTier, number> = { 'ultra-premium': 0, premium: 1, standard: 2 };
  return results.sort((a, b) => order[a.tier] - order[b.tier]);
}

// ─── Gemini fallback (for airports not in local DB) ───────────────────────────

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
      const labels: Record<string, string> = {
        'priority-pass': 'Priority Pass', 'lounge-key': 'LoungeKey',
        'dragon-pass': 'DragonPass', 'amex-platinum': 'Amex Centurion/Platinum',
      };
      creds.push(`  → Networks: ${q.cardNetworks.map((n) => labels[n] ?? n).join(', ')}`);
    }
  }
  if (q.statusName) {
    creds.push(`• Airline status: ${q.statusName}`);
    if (q.allianceTier) creds.push(`  → Alliance tier: ${q.allianceTier}`);
  }

  const carrierCode = q.operatingCarrierCode?.toUpperCase();
  const carrierAlliance = carrierCode ? (CARRIER_ALLIANCE[carrierCode] ?? null) : null;
  const carrierNote = carrierCode
    ? `${q.airline ?? carrierCode} (${carrierCode})${carrierAlliance ? ` — ${carrierAlliance}` : ' — not an alliance member'}`
    : 'not specified';

  const zoneNote =
    q.departureZone === 'schengen'     ? 'Schengen-side lounges only.' :
    q.departureZone === 'non-schengen' ? 'Non-Schengen/International-side lounges only.' :
    'All accessible airside lounges.';

  return `You are an expert airport lounge consultant (knowledge: 2024-2025).

AIRPORT: ${q.airportName} (${q.airportIata})${q.terminal ? ` — ${q.terminal}` : ''}
CARRIER: ${carrierNote}
${q.destination ? `DESTINATION: ${q.destination}` : ''}
${q.gate ? `GATE: ${q.gate}` : ''}
ZONE: ${zoneNote}

CREDENTIALS
${creds.join('\n') || '• None'}

ALLIANCE RULES (strictly enforced by server after your response):
${carrierAlliance
  ? `⚠ Flying ${carrierAlliance} → only ${carrierAlliance} alliance lounges via status.`
  : '• Carrier unknown — include alliance lounges where status clearly applies.'}
• oneworld Emerald → First + Business lounges of any oneworld carrier
• oneworld Sapphire → Business lounges only
• Star Alliance Gold → Business/Senator lounges of any SA carrier
• SkyTeam Elite Plus → Business lounges of any SkyTeam carrier

Set "network" to the specific credential granting access:
oneworld | star-alliance | skyteam | priority-pass | lounge-key | dragon-pass | amex-centurion | airline-own | independent

Set "loungeClass": first | business | standard
${q.gate ? `Include "walkingInfo": "~X min from Gate ${q.gate}" for each lounge.` : ''}

Return ONLY valid JSON:
{
  "lounges": [{
    "id": "slug", "name": "Full name", "location": "Terminal/Level/Area",
    "accessMethod": "Human-readable reason", "hours": "HH:MM–HH:MM or 24h",
    "amenities": ["up to 5"], "tier": "ultra-premium|premium|standard",
    "network": "...", "loungeClass": "first|business|standard"
    ${q.gate ? ', "walkingInfo": "~X min from Gate Y"' : ''}
  }],
  "notes": "Any caveats"
}`;
}

function buildVerifyPrompt(q: LoungeQuery, prev: string): string {
  const carrierCode = q.operatingCarrierCode?.toUpperCase();
  const carrierAlliance = carrierCode ? (CARRIER_ALLIANCE[carrierCode] ?? null) : null;
  return `Validate this lounge list for ${q.airportIata}:
${prev}

Carrier: ${q.airline ?? 'unknown'}${carrierCode ? ` (${carrierCode})` : ''}${carrierAlliance ? ` — ${carrierAlliance}` : ''}
Credentials: ${[q.cardName, q.statusName, q.allianceTier].filter(Boolean).join(' / ') || 'none'}

Check: lounge exists at this airport, network/loungeClass are correct, no wrong-alliance lounges.
Fix errors, remove invalid entries, add missing qualifying lounges.

Return corrected JSON in same schema, no markdown.`;
}

function normalizeAILounges(raw: AILounge[]): AILounge[] {
  return raw.map((l, i) => ({
    ...l,
    id:          l.id || `lounge-${i}`,
    tier:        VALID_TIERS.has(l.tier as AILoungeTier)         ? l.tier        : 'standard'     as AILoungeTier,
    network:     VALID_NETWORKS.has(l.network as LoungeNetwork)  ? l.network     : 'independent'  as LoungeNetwork,
    loungeClass: VALID_CLASSES.has(l.loungeClass as LoungeClass) ? l.loungeClass : 'business'     as LoungeClass,
  }));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: LoungeQuery;
  try {
    body = await req.json() as LoungeQuery;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.airportIata) {
    return NextResponse.json({ error: 'airportIata is required' }, { status: 400 });
  }

  // ── Static path: airport is in our local database ─────────────────────────
  const staticData = LOUNGE_DATABASE[body.airportIata.toUpperCase()];
  if (staticData) {
    const lounges = resolveStaticLounges(staticData, body);
    return NextResponse.json({
      lounges,
      notes: lounges.length === 0
        ? 'No lounges found for your credentials at this airport.'
        : undefined,
    });
  }

  // ── Gemini fallback: airport not in local database ────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Airport not in local database and AI is not configured on server.', lounges: [] },
      { status: 503 },
    );
  }

  try {
    type AIResponse = { lounges?: AILounge[]; notes?: string };

    const step1Raw = await callGemini(buildPrompt(body), apiKey);
    let step1: AIResponse | null = null;
    try { step1 = JSON.parse(step1Raw) as AIResponse; } catch { /* ignore */ }

    const step2Raw = await callGemini(buildVerifyPrompt(body, step1Raw), apiKey);
    let step2: AIResponse | null = null;
    try { step2 = JSON.parse(step2Raw) as AIResponse; } catch { /* ignore */ }

    const rawLounges = normalizeAILounges(step2?.lounges ?? step1?.lounges ?? []);

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
