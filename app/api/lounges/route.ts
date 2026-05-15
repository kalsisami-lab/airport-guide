import { NextRequest, NextResponse } from 'next/server';
import type { AILounge } from '@/lib/aiLounge';

interface LoungeQuery {
  airportIata: string;
  airportName: string;
  terminal?: string;
  airline?: string;
  cardName?: string;
  cardNetworks?: string[];
  statusName?: string;
  allianceTier?: string;
  departureZone?: 'schengen' | 'non-schengen' | 'international';
  destination?: string;
  gate?: string;
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

function buildPrompt(q: LoungeQuery): string {
  const creds: string[] = [];
  if (q.cardName) {
    creds.push(`• Credit card: ${q.cardName}`);
    if (q.cardNetworks?.length) {
      const networkLabels: Record<string, string> = {
        'priority-pass': 'Priority Pass',
        'lounge-key': 'LoungeKey',
        'dragon-pass': 'DragonPass',
        'amex-platinum': 'Amex Centurion/Platinum',
      };
      const nets = q.cardNetworks.map((n) => networkLabels[n] ?? n).join(', ');
      creds.push(`  → Lounge networks: ${nets}`);
    }
  }
  if (q.statusName) {
    creds.push(`• Airline status: ${q.statusName}`);
    if (q.allianceTier) {
      creds.push(`  → Alliance tier: ${q.allianceTier}`);
    }
  }

  const zoneNote =
    q.departureZone === 'schengen'
      ? 'The user is departing within the Schengen Area — only include Schengen-side lounges.'
      : q.departureZone === 'non-schengen'
      ? 'The user is departing outside the Schengen Area — only include Non-Schengen/International-side lounges.'
      : 'International airport — show all accessible airside lounges.';

  return `You are an expert airport lounge consultant with comprehensive knowledge of global airport lounges, access policies, and alliance rules as of 2024-2025.

USER SITUATION
• Airport: ${q.airportName} (${q.airportIata})${q.terminal ? ` — ${q.terminal}` : ''}
• Departing airline: ${q.airline ?? 'not specified'}
${q.destination ? `• Destination: ${q.destination}` : ''}
${q.gate ? `• Departure gate: ${q.gate}` : ''}
• ${zoneNote}

USER CREDENTIALS
${creds.length ? creds.join('\n') : '• None provided'}

ALLIANCE ACCESS RULES — apply these EXACTLY:
• oneworld Emerald → First Class AND Business Class lounges of ANY oneworld carrier (Finnair, British Airways, Cathay Pacific, JAL, Qantas, Malaysia, Iberia, Royal Jordanian, SriLankan, etc.)
• oneworld Sapphire → Business Class lounges of ANY oneworld carrier
• Star Alliance Gold → Business/Senator lounges of ANY Star Alliance carrier (Lufthansa, SAS, Turkish, Singapore, ANA, Thai, Air Canada, etc.)
• SkyTeam Elite Plus → Business lounges of ANY SkyTeam carrier (Air France, KLM, Delta, Korean Air, etc.)
• Priority Pass → independent lounges contracted with Priority Pass at this airport
• LoungeKey → independent lounges contracted with LoungeKey (similar to PP, different network)
• DragonPass → independent lounges contracted with DragonPass

TASK
List ALL lounges at ${q.airportIata} that this user can access right now.
Be accurate and conservative. If a lounge's access rule for this user is uncertain, include it with a note.
${q.gate ? `Estimate walking time from Gate ${q.gate} for each lounge.` : ''}

Return ONLY valid JSON in this exact schema (no markdown, no explanation):
{
  "lounges": [
    {
      "id": "kebab-slug-unique",
      "name": "Official full lounge name",
      "location": "Terminal, Level, Wing or area",
      "accessMethod": "Exact credential that grants access (e.g. oneworld Emerald, Priority Pass)",
      "hours": "Daily HH:MM–HH:MM or check at lounge",
      "amenities": ["up to 5 key amenities"],
      "tier": "ultra-premium OR premium OR standard",
      "walkingInfo": "~X min from Gate Y (only if gate provided, else omit this field)"
    }
  ],
  "notes": "Any important caveats, conditions, or guest policy info"
}`;
}

function buildVerifyPrompt(q: LoungeQuery, initialJson: string): string {
  return `You are a strict airport lounge access validator.

Review this lounge access list for a user at ${q.airportName} (${q.airportIata}):
${initialJson}

User credentials: ${[q.cardName, q.statusName, q.allianceTier].filter(Boolean).join(' / ') || 'none'}

VERIFY each lounge:
1. Does this lounge ACTUALLY exist and operate at ${q.airportIata}?
2. Is the stated access method CORRECT for this user's credentials?
3. Are alliance rules applied properly (e.g. oneworld Emerald = any OW First/Business, not just own airline)?
4. Are any lounges missing that this user can access?

Remove lounges where access is incorrect.
Fix name, location, or access method errors.
Add any missed lounges.

Return the corrected JSON in the EXACT same schema with no markdown:
{
  "lounges": [...],
  "notes": "Verification complete. Changes made: ..."
}`;
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
    // Step 1 — generate initial lounge list
    const step1Raw = await callGemini(buildPrompt(body), apiKey);
    let step1: { lounges?: AILounge[]; notes?: string };
    try {
      step1 = JSON.parse(step1Raw) as { lounges?: AILounge[]; notes?: string };
    } catch {
      step1 = { lounges: [] };
    }

    // Step 2 — verification pass
    const step2Raw = await callGemini(buildVerifyPrompt(body, step1Raw), apiKey);
    let step2: { lounges?: AILounge[]; notes?: string };
    try {
      step2 = JSON.parse(step2Raw) as { lounges?: AILounge[]; notes?: string };
    } catch {
      step2 = step1;
    }

    const lounges = (step2.lounges ?? step1.lounges ?? []).map((l, i) => ({
      ...l,
      id: l.id || `lounge-${i}`,
      tier: (['ultra-premium', 'premium', 'standard'] as const).includes(l.tier as AILoungeTier)
        ? l.tier
        : 'standard' as AILoungeTier,
    }));

    return NextResponse.json({ lounges, notes: step2.notes });
  } catch (err) {
    console.error('AI lounge lookup failed:', err);
    return NextResponse.json(
      { error: 'AI lookup failed — please try again', lounges: [] },
      { status: 500 },
    );
  }
}

type AILoungeTier = 'ultra-premium' | 'premium' | 'standard';
