import { NextRequest, NextResponse } from 'next/server';
import type { ChatContext, ChatMessage } from '@/lib/chatTypes';

export type { ChatContext, ChatMessage };

// ── Supported airports for referencing local lounge data ─────────────────────
const SUPPORTED_IATAS = new Set(['HEL', 'LHR', 'AMS', 'ARN', 'FRA', 'CDG', 'HKG']);

function buildSystemPrompt(ctx: ChatContext): string {
  const p: string[] = [];

  // ── Language — must be first so the model always respects it ────────────────
  p.push(
    `CRITICAL LANGUAGE RULE — OBEY BEFORE EVERYTHING ELSE: ` +
    `Detect the language of the traveller's message and reply in that EXACT same language. ` +
    `Finnish example: "Saako loungessa shampanjaa?" → your ENTIRE reply must be in fluent Finnish. ` +
    `English example: "Is there champagne?" → reply in English. ` +
    `Never default to English. Never mix languages. If the message contains Finnish words (ä, ö, å, or words like "saako", "onko", "loungessa"), it IS Finnish — reply in Finnish. ` +
    `When replying in Finnish, use natural everyday Finnish — not formal or stilted language.`,
  );

  // ── Role & style ────────────────────────────────────────────────────────────
  p.push(
    `You are an expert airport concierge and lounge access specialist embedded in a mobile airport guide app. ` +
    `Your knowledge covers alliance lounge rules, Priority Pass and LoungeKey networks, credit card travel perks, and major international airports worldwide. ` +
    `CRITICAL: Always read and directly answer the traveller's exact question. ` +
    `If they ask about a specific feature (champagne, food, showers, wifi, children's area, etc.), look it up in the LOUNGE AMENITIES section below and answer specifically. ` +
    `Do NOT default to reciting their lounge access summary — they already see that on screen. ` +
    `Answer in 2–4 sentences of plain text. No markdown, no bullet points, no headers. ` +
    `Be precise, practical, and friendly — the traveller is at the airport right now.`,
  );

  // ── Alliance rules (always included) ────────────────────────────────────────
  p.push(`
ALLIANCE LOUNGE RULES:
oneworld Emerald (= Finnair Plus Platinum, BA Executive Club Gold, AA Executive Platinum, CX Diamond, QF Platinum, JL JMB Diamond): Access to BOTH First Class AND Business Class lounges at any oneworld partner airport, but ONLY when travelling on a oneworld carrier (Finnair AY, British Airways BA, Iberia IB, American AA, Cathay Pacific CX, Qantas QF, Japan Airlines JL, Malaysia Airlines MH, Royal Jordanian RJ). This is the top tier — use it for the best lounge.
oneworld Sapphire (= Finnair Plus Gold, BA Silver, AA Platinum, CX Gold, QF Gold): Access to Business Class lounges at oneworld partner airports when flying a oneworld carrier.
Star Alliance Gold (= LH HON Circle/Senator, UA 1K/Platinum, SQ PPS Club, SQ KrisFlyer Gold, SK Gold, TK Elite Plus, LX HON Circle/Senator, OS HON Circle/Senator): Access to Business Class lounges when flying ANY Star Alliance carrier (Lufthansa, United, Singapore Airlines, ANA, Turkish, SAS, Swiss, Austrian, Air Canada, Thai, TAP, Asiana, Ethiopian, Aegean, Shenzhen, Brussels).
SkyTeam Elite Plus (= AF/KL Platinum, DL Diamond, KE Morning Calm Premium): Access to SkyTeam partner lounges when flying a SkyTeam carrier (Air France, KLM, Delta, Korean Air, China Eastern, Aeroflot, MEA, ITA Airways, Aeromexico, Garuda, Vietnam Airlines, TAROM, Czech Airlines).
Priority Pass / LoungeKey / DragonPass: Card-based network giving access to independent third-party lounges (NOT airline-branded ones unless they opt in). Priority Pass has 1,500+ lounges; LoungeKey ~1,000. American Express Platinum typically includes Priority Pass Prestige (unlimited visits). These work regardless of which airline you're flying.`);

  // ── Airport-specific lounge knowledge ───────────────────────────────────────
  p.push(`
AIRPORT LOUNGE KNOWLEDGE:

HKG — Hong Kong International Airport (major oneworld hub, Cathay Pacific home base):
Terminal 1 is the only international terminal. All CX lounges are airside.
THE WING (Level 6, check-in row 1 end): CX First Class Lounge (oneworld Emerald when flying any oneworld carrier; CX First ticket) — The Haven spa, private cabanas, champagne. CX Business Class Lounge (oneworld Sapphire/Emerald when flying oneworld) — noodle bar, shower suites.
THE PIER (Level 6, opposite end, Pier E area): CX First Class and Business Class lounges, same access rules as The Wing but different design; generally considered the premium option.
THE BRIDGE (Midfield Concourse): CX Business lounge serving Midfield Concourse gates, same access rules.
THE ARC (Terminal 2/Sky Pier area, gate 500s): CX lounge for Sky Pier gates.
QANTAS INTERNATIONAL BUSINESS LOUNGE (Gate 1-2 area, T1): oneworld Sapphire and Emerald when flying Qantas.
PLAZA PREMIUM LOUNGE: 3 locations in T1 (near gates 1, 35, 60). Accepts Priority Pass, LoungeKey, Amex Platinum. Good food quality, full bar. Best independent option for non-oneworld travellers.
KOREAN AIR LOUNGE: SkyTeam Elite Plus when flying Korean Air; Korean Air business/first class.
UNITED CLUB at HKG: Star Alliance Gold when flying United; United Polaris business/first.
TIP: For oneworld Emerald/Sapphire holders flying AY/CX/BA, The Pier First or The Wing First is the standout choice at HKG — one of the world's best lounge experiences.

HEL — Helsinki-Vantaa (Finnair hub, oneworld, Schengen/Non-Schengen split):
FINNAIR PLATINUM WING (Gate 36, Pier D, non-Schengen): ultra-exclusive, oneworld Emerald / Finnair Platinum ONLY. Spa, sauna, à la carte dining.
FINNAIR LOUNGE non-Schengen (Pier D/E): oneworld Sapphire/Emerald, Finnair Gold/Platinum, Business/First class. Full buffet, showers.
FINNAIR LOUNGE Schengen (Pier B): same access as non-Schengen side. Hot buffet, bar, showers.
HELSINKI AIRPORT LOUNGE (Pier C, Schengen): Priority Pass / LoungeKey / DragonPass. Light buffet.
PIER ZERO RESTAURANT (Gate 28, Schengen): Amex Platinum dining credit. Nordic cuisine.
OP LOUNGE (Gate 22, Schengen): OP card holders only.

LHR — London Heathrow (Terminal 5 = BA/oneworld; T2 = Star Alliance):
BA CONCORDE ROOM (T5): oneworld Emerald or First Class ticket. One of the world's top lounges.
BA FIRST LOUNGE (T5A): oneworld Emerald or First Class. Sit-down dining, cocktail bar.
BA GALLERIES CLUB (T5): oneworld Sapphire/Emerald, Business/First class, and Priority Pass. Hot buffet, bar.
NO1 LOUNGE (T2): Priority Pass / LoungeKey / DragonPass. Star Alliance terminal, good independent option.
ASPIRE LOUNGE (T5): Priority Pass / LoungeKey. Useful if you can't access BA lounges.

AMS — Amsterdam Schiphol (KLM/SkyTeam hub, all one terminal):
KLM CROWN LOUNGE non-Schengen (Pier E): SkyTeam Elite Plus, Business/First, Priority Pass. Dutch hospitality, Heineken bar.
KLM CROWN LOUNGE Schengen (Pier D/F): same access. Dutch-themed, strong buffet.
ASPIRE LOUNGE Schengen: Priority Pass / LoungeKey.

FRA — Frankfurt (Lufthansa/Star Alliance hub):
LH SENATOR LOUNGE (Concourse B, non-Schengen): Star Alliance Gold or First class. À la carte dining, top-tier.
LH BUSINESS LOUNGE non-Schengen (Concourse B): Star Alliance Gold, Business/First. Full buffet.
LH BUSINESS LOUNGE Schengen (Concourse A): same access.
ASPIRE LOUNGE (Concourse B): Priority Pass / LoungeKey.
GATE GOURMET LOUNGE (Terminal 2): Priority Pass / LoungeKey, Schengen.

CDG — Paris Charles de Gaulle (Air France/SkyTeam hub, 2F Schengen / 2E Non-Schengen):
AF SALON Schengen (Hall 2F): oneworld Sapphire/Emerald, Finnair Gold/Platinum (bilateral agreement), SkyTeam Elite Plus, Business/First.
AF SALON non-Schengen (Hall 2E): oneworld Emerald only, SkyTeam Elite Plus, Business/First.
ASPIRE LOUNGE Schengen (2F): Priority Pass / LoungeKey.
SALON EXTIME non-Schengen (Hall 2E): Priority Pass / LoungeKey / DragonPass.

ARN — Stockholm Arlanda (SAS/Star Alliance hub, T5):
SAS GOLD LOUNGE (non-Schengen, Pier F): Star Alliance Gold, Business/First, Priority Pass.
SAS BUSINESS LOUNGE Schengen (Pier E): same access as Gold Lounge.
NO1 LOUNGE Arlanda: Priority Pass / LoungeKey.`);

  // ── Traveller context ────────────────────────────────────────────────────────
  const ctx_lines: string[] = [];

  if (ctx.airport) ctx_lines.push(`Airport: ${ctx.airport}${ctx.airportIata ? ` (${ctx.airportIata})` : ''}`);
  if (ctx.gate) ctx_lines.push(`Gate: ${ctx.gate}`);
  if (ctx.cardName) ctx_lines.push(`Credit card: ${ctx.cardName}`);
  if (ctx.statusName) ctx_lines.push(`Airline status: ${ctx.statusName}`);
  if (ctx.flightNumber) ctx_lines.push(`Flight: ${ctx.flightNumber}`);
  if (ctx.destination) ctx_lines.push(`Flying to: ${ctx.destination}`);
  if (ctx.area) ctx_lines.push(`Flight area: ${ctx.area}`);
  if (ctx.fastTrack !== undefined) ctx_lines.push(`Fast Track eligible: ${ctx.fastTrack ? 'yes' : 'no'}`);
  if (ctx.allianceAccess) {
    ctx_lines.push(`Alliance access: ${ctx.allianceAccess.alliance} ${ctx.allianceAccess.tier}`);
  }

  if (ctx.lounges && ctx.lounges.length > 0) {
    const accessible = ctx.lounges.filter((l) => l.accessible);
    const blocked = ctx.lounges.filter((l) => !l.accessible);
    if (accessible.length > 0) {
      ctx_lines.push(
        `Accessible lounges (app confirmed): ${accessible.map((l) => `${l.name} [${l.tier}] via ${l.reason}`).join(' | ')}`,
      );
      // Inject amenities so the model can answer feature-specific questions
      const amenityLines = accessible
        .filter((l) => l.amenities && l.amenities.length > 0)
        .map((l) => `  ${l.name}: ${l.amenities!.join(', ')}`);
      if (amenityLines.length > 0) {
        ctx_lines.push(`LOUNGE AMENITIES (use these to answer questions about food, drinks, and facilities):\n${amenityLines.join('\n')}`);
      }
    }
    if (blocked.length > 0) {
      ctx_lines.push(`Blocked (wrong area for this flight): ${blocked.map((l) => l.name).join(', ')}`);
    }
  } else if (ctx.airportIata && !SUPPORTED_IATAS.has(ctx.airportIata)) {
    ctx_lines.push(
      `Note: App has no curated lounge database for ${ctx.airportIata} — answer using alliance knowledge and the lounge data above.`,
    );
  }

  if (ctx_lines.length > 0) {
    p.push(
      `\nTHIS TRAVELLER'S CONTEXT (use this to personalise — never ask them to repeat it):\n` +
      ctx_lines.join('\n'),
    );
  }

  return p.join('\n');
}

// ── Simulation fallback (no API key, or API quota exceeded) ──────────────────

// Returns all amenities from the user's accessible lounges as a flat deduplicated list.
function collectAccessibleAmenities(ctx: ChatContext): string[] {
  const accessible = ctx.lounges?.filter((l) => l.accessible) ?? [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const l of accessible) {
    for (const a of l.amenities ?? []) {
      const key = a.toLowerCase();
      if (!seen.has(key)) { seen.add(key); result.push(a); }
    }
  }
  return result;
}

// Checks whether a feature keyword appears in the available amenities.
function amenityHas(amenities: string[], ...keywords: string[]): boolean {
  const joined = amenities.join(' ').toLowerCase();
  return keywords.some((k) => joined.includes(k.toLowerCase()));
}

function simulate(userMessage: string, ctx: ChatContext): string {
  const allianceName = ctx.allianceAccess
    ? ctx.allianceAccess.alliance === 'oneworld' ? 'oneworld'
    : ctx.allianceAccess.alliance === 'star-alliance' ? 'Star Alliance'
    : 'SkyTeam'
    : null;

  const alliancePartners: Record<string, string> = {
    oneworld:        'Cathay Pacific, British Airways, Qantas, American Airlines, or Japan Airlines',
    'star-alliance': 'Lufthansa, United Airlines, Singapore Airlines, Turkish Airlines, or ANA',
    skyteam:         'Air France, KLM, Delta Air Lines, or Korean Air',
  };

  const accessible = ctx.lounges?.filter((l) => l.accessible) ?? [];
  const amenities  = collectAccessibleAmenities(ctx);
  const hasLounges = accessible.length > 0;
  const bestLounge = accessible[0];

  // ── Feature-specific questions (answered from amenity data when available) ──
  // These must be checked BEFORE the generic "lounge" keyword branch so that
  // "Saako loungessa shampanjaa?" doesn't collapse into the access template.

  const isChampagne = /champagne|sparkling|bubbly|samppanja|shampanj/i.test(userMessage);
  const isFood      = /food|eat|meal|buffet|dining|menu|cuisine|restaurant|ruoka|syö/i.test(userMessage);
  const isBar       = /\bbar\b|drink|alcohol|wine|beer|spirit|cocktail|juoma|alkohol/i.test(userMessage);
  const isShower    = /shower|bath|wash|suihku/i.test(userMessage);
  const isWifi      = /wifi|wi-fi|internet|wireless/i.test(userMessage);
  const isSpa       = /\bspa\b|massage|sauna|relax|hieronta/i.test(userMessage);
  const isChildren  = /child|kid|baby|family|lapsi|perhe/i.test(userMessage);
  const isWork      = /work|desk|business.cent|laptop|office|työ/i.test(userMessage);

  const isFinnish = /[äöåÄÖÅ]/.test(userMessage) ||
    /\b(saako|onko|voiko|missä|milloin|loungessa|shampanjaa|ruokaa|suihku|hieronta|pääsy|pääsen|kyllä|kuinka|paljonko|miten)\b/i.test(userMessage);

  if (isChampagne || isBar) {
    if (hasLounges) {
      const hasChamp = amenityHas(amenities, 'champagne');
      const hasBar   = amenityHas(amenities, 'bar', 'cocktail', 'spirits', 'premium bar');
      if (isChampagne) {
        if (isFinnish) {
          if (hasChamp) return `Kyllä — ${bestLounge.name} tarjoaa samppanjaa premium-baarissaan. Sitä on vapaasti tarjolla baarissa aukioloaikoina.`;
          if (hasBar)   return `${bestLounge.name}ssa on täysi baari viineineen ja tislatuine juomineen, mutta samppanjaa ei ole erikseen mainittu palvelulistalla — kannattaa tiedustella henkilökunnalta.`;
          return `Samppanjaa ei ole mainittu loungesi palveluissa${ctx.airport ? ` ${ctx.airport}ssa` : ''}. Kuplajuomaa saattaa silti löytyä baarista — kysy tiskiltä.`;
        }
        if (hasChamp) return `Yes — ${bestLounge.name} offers champagne as part of its premium bar. It's available to help yourself at the bar area during opening hours.`;
        if (hasBar)   return `${bestLounge.name} has a full bar with wines and spirits, but champagne isn't specifically listed in the amenities — ask staff at the bar when you arrive.`;
        return `Champagne isn't listed in the amenities for your accessible lounge${ctx.airport ? ` at ${ctx.airport}` : ''}. The bar may still have sparkling wine — worth asking at the counter.`;
      }
      // General bar question
      if (isFinnish) {
        if (hasBar) return `Kyllä — ${bestLounge.name}ssa on baari${amenityHas(amenities, 'cocktail') ? ', myös cocktaileja' : ''}. Juomat ovat maksuttomia vierailun aikana.`;
        return `${bestLounge.name}ssa on juomapalvelu, mutta täyttä baaria ei ole erikseen mainittu — kevyitä juomia ja alkoholittomia vaihtoehtoja on yleensä tarjolla kaikissa loungeissa.`;
      }
      if (hasBar) return `Yes — ${bestLounge.name} has a bar serving drinks${amenityHas(amenities, 'cocktail') ? ', including cocktails' : ''}. It's complimentary during your visit.`;
      return `${bestLounge.name} has beverage service but a full bar isn't specifically listed — light drinks and non-alcoholic options are typically available in all lounges.`;
    }
  }

  if (isFood) {
    if (hasLounges) {
      const hasAlaCarte = amenityHas(amenities, 'à la carte', 'a la carte', 'dining', 'restaurant', 'chef');
      const hasBuffet   = amenityHas(amenities, 'buffet');
      if (isFinnish) {
        if (hasAlaCarte) return `${bestLounge.name} tarjoaa à la carte -ruokailun — voit tilata listalta buffet-pöydän sijaan. Erinomainen vaihtoehto kunnon aterialle ennen lentoa.`;
        if (hasBuffet)   return `${bestLounge.name}ssa on lämmin ja kylmä buffet. Ruoka on itsepalvelua ja täydennetään aukioloaikoina — hyvä vaihtoehto pikaiselle aterialle tai välipaloille.`;
        return `${bestLounge.name}ssa on välipaloja ja kevyttä ruokaa tarjolla. Tarkista valikko saapuessasi loungeen.`;
      }
      if (hasAlaCarte) return `${bestLounge.name} offers à la carte dining — you can order from a menu rather than just a buffet. A great option for a proper meal before your flight.`;
      if (hasBuffet)   return `${bestLounge.name} has a hot and cold buffet. Food is self-serve and replenished throughout opening hours — good for a quick meal or snacks.`;
      return `Light food and snacks are available at ${bestLounge.name}. For a full meal, check the lounge's menu board when you arrive.`;
    }
  }

  if (isShower) {
    if (hasLounges) {
      const hasShower = amenityHas(amenities, 'shower');
      if (isFinnish) {
        if (hasShower) return `Kyllä — ${bestLounge.name}ssa on suihkuhuoneet. Pyyhkeet ja tarvikkeet kuuluvat hintaan; kysy vastaanotosta vuorolistaa, sillä suihkut voivat olla varattuja.`;
        return `Suihkua ei ole mainittu ${bestLounge.name}n palveluissa. Kysy henkilökunnalta — joissakin loungeissa on tiloja, joita ei ole listattu verkossa.`;
      }
      if (hasShower) return `Yes — ${bestLounge.name} has shower suites available. Towels and toiletries are provided; you may need to request a slot at the reception desk as demand can be high.`;
      return `Showers aren't listed in the amenities for ${bestLounge.name}. If you need a shower, ask staff when you arrive — some lounges have facilities not shown online.`;
    }
  }

  if (isSpa) {
    if (hasLounges) {
      const hasSpa = amenityHas(amenities, 'spa', 'massage', 'sauna');
      if (isFinnish) {
        if (hasSpa) return `Kyllä — ${bestLounge.name}ssa on kylpylä- tai hyvinvointipalveluja. Nämä ovat loungen kohokohta; varaa tai pyydä aikaa heti vastaanotosta.`;
        return `Kylpylä- tai hierontapalveluja ei ole mainittu ${bestLounge.name}lle. Loungessa on kuitenkin mukavat lepotilat ja suihkutilat.`;
      }
      if (hasSpa) return `Yes — ${bestLounge.name} has spa or wellness facilities. These are a highlight of the lounge; book or request a slot at reception as soon as you arrive.`;
      return `Spa or massage services aren't listed for ${bestLounge.name}. The lounge still offers shower facilities and a comfortable rest area.`;
    }
  }

  if (isWifi) {
    if (hasLounges) {
      const hasWifi = amenityHas(amenities, 'wifi', 'wi-fi', 'internet');
      if (isFinnish) {
        if (hasWifi) return `Kyllä — ${bestLounge.name}ssa on nopea WiFi. Salasana on yleensä vastaanotossa tai pöydillä loungetiloissa.`;
        return `WiFi:tä ei ole vahvistettu ${bestLounge.name}lle, mutta käytännössä kaikissa lentokenttäloungeissa on se — kysy salasana henkilökunnalta.`;
      }
      if (hasWifi) return `Yes — ${bestLounge.name} has high-speed WiFi. The password is usually on a card at the reception desk or on tables throughout the lounge.`;
      return `WiFi availability isn't confirmed for ${bestLounge.name}, but virtually all airport lounges offer it — ask staff for the network name and password.`;
    }
  }

  if (isChildren) {
    if (hasLounges) {
      const hasKids = amenityHas(amenities, "children's", 'kids', 'family', 'play');
      if (isFinnish) {
        if (hasKids) return `Kyllä — ${bestLounge.name}ssa on lasten- tai perhetilat. Hyvä vaihtoehto lasten kanssa matkustaville.`;
        return `Erillistä lastenhuonetta ei ole mainittu ${bestLounge.name}lle, mutta perheet ovat tervetulleita — loungessa on mukavat istumapaikat ja lapsille sopivaa ruokaa.`;
      }
      if (hasKids) return `Yes — ${bestLounge.name} has a children's area or family facilities. A great option if you're travelling with kids.`;
      return `A dedicated children's area isn't listed for ${bestLounge.name}, but families are welcome — the lounge will have comfortable seating and food options suitable for children.`;
    }
  }

  if (isWork) {
    if (hasLounges) {
      const hasWork = amenityHas(amenities, 'work', 'desk', 'business centre', 'station');
      if (isFinnish) {
        if (hasWork) return `Kyllä — ${bestLounge.name}ssa on työskentelypisteet ja toimistotilat. Etsi erillinen työskentelyalue, joka on yleensä hiljaisempi kuin päälounge.`;
        return `Erillisiä työskentelypisteitä ei ole mainittu ${bestLounge.name}lle, mutta kaikissa loungeissa on istumapaikkoja ja pistorasioita kannettavaa varten.`;
      }
      if (hasWork) return `Yes — ${bestLounge.name} has work desks and business facilities. Look for the dedicated workstation area, usually quieter than the main lounge space.`;
      return `Dedicated work desks aren't specifically listed for ${bestLounge.name}, but all lounges have seating with power outlets — suitable for laptop work.`;
    }
  }

  // ── Lounge access question ──────────────────────────────────────────────────
  // Only match explicit lounge/access questions — avoid catching Finnish words
  // like "loungessa" as a lounge-access query when it's really a feature question.
  const isAccessQuestion = /\b(lounge|access|enter|get in|pääsy|pääsen)\b/i.test(userMessage) &&
    !isChampagne && !isFood && !isBar && !isShower && !isSpa && !isWifi && !isChildren && !isWork;

  if (isAccessQuestion) {
    if (hasLounges) {
      const others   = accessible.slice(1).map((l) => l.name);
      if (isFinnish) {
        const otherStr = others.length > 0 ? ` Sinulla on myös pääsy seuraaviin: ${others.join(', ')}.` : '';
        const airportStr = ctx.airport ? ` ${ctx.airport}ssa` : '';
        return `Paras loungesi${airportStr} on ${bestLounge.name} (${bestLounge.tier.replace('-', ' ')}) — pääsy ${bestLounge.reason}lla.${otherStr} Saavu loungeen noin 90 minuuttia ennen lähtöä ja näytä boarding pass tai statuskortti.`;
      }
      const otherStr = others.length > 0 ? ` You also have access to ${others.join(', ')}.` : '';
      const airportStr = ctx.airport ? ` at ${ctx.airport}` : '';
      return `Your top lounge${airportStr} is ${bestLounge.name} (${bestLounge.tier.replace('-', ' ')}) via your ${bestLounge.reason}.${otherStr} Head to the lounge about 90 minutes before departure and show your boarding pass or status card.`;
    }
    if (ctx.allianceAccess && allianceName) {
      const { tier } = ctx.allianceAccess;
      const partners = alliancePartners[ctx.allianceAccess.alliance] ?? 'partner carrier lounges';
      const classAccess = tier === 'Emerald' ? 'both First Class and Business Class lounges' : 'Business Class lounges';
      if (isFinnish) {
        const classAccessFI = tier === 'Emerald' ? 'sekä First Class- että Business Class -loungeihin' : 'Business Class -loungeihin';
        return `${allianceName} ${tier} -jäsenenä${ctx.airport ? ` ${ctx.airport}ssa` : ''} sinulla on pääsy ${classAccessFI} kaikilla ${allianceName}-lentoasemilla lennettäessä ${allianceName}-lentoyhtiöllä. Näytä jäsenkorttisi vastaanottoon.`;
      }
      return `As a ${allianceName} ${tier} member${ctx.airport ? ` at ${ctx.airport}` : ''}, you can access ${classAccess} at any ${allianceName} partner airport when flying a ${allianceName} carrier. Look for ${partners} lounges — show your membership card at reception.`;
    }
    if (ctx.airportIata === 'HKG') {
      return isFinnish
        ? 'HKG:ssä Cathay Pacificin loungit (The Wing, The Pier) ovat käytettävissä oneworld Sapphire- tai Emerald-statuksella. Plaza Premium hyväksyy Priority Passin kolmessa sijainnissa T1:ssä.'
        : 'At HKG, the Cathay Pacific lounges (The Wing, The Pier) are accessible with oneworld Sapphire or Emerald status. Plaza Premium accepts Priority Pass at three locations across T1.';
    }
    return isFinnish
      ? 'Valitse kortti tai lentoyhtiöstatus yllä, niin kerron täsmälleen mihin loungeihin sinulla on pääsy.'
      : 'Select your credit card or airline status above and I can tell you exactly which lounges you can access.';
  }

  // ── Fast Track / security ───────────────────────────────────────────────────
  if (/fast.?track|security|queue|lane|turvatarkastus|jono/i.test(userMessage)) {
    if (ctx.fastTrack) {
      const suffix = ctx.allianceAccess ? ` as a ${allianceName} ${ctx.allianceAccess.tier} member` : '';
      const suffixFI = ctx.allianceAccess ? ` ${allianceName} ${ctx.allianceAccess.tier} -jäsenenä` : '';
      if (isFinnish) return `Kyllä — sinulla on Fast Track -oikeus${ctx.airport ? ` ${ctx.airport}ssa` : ''}${suffixFI}. Etsi erillinen Fast Track -kaista turvatarkastuksessa — se on yleensä erikseen opastettu.`;
      return `Yes — you have Fast Track access${ctx.airport ? ` at ${ctx.airport}` : ''}${suffix}. Look for the dedicated Fast Track lane at security, usually signposted separately from the main queue.`;
    }
    if (isFinnish) return `Fast Trackia ei ole vahvistettu nykyisillä tiedoillasi${ctx.airport ? ` ${ctx.airport}ssa` : ''}. Varaa vähintään 30–40 minuuttia tavalliseen turvatarkastukseen.`;
    return `Fast Track isn't confirmed for your current setup${ctx.airport ? ` at ${ctx.airport}` : ''}. Allow at least 30–40 minutes for standard security.`;
  }

  // ── HKG-specific ────────────────────────────────────────────────────────────
  if (/hkg|hong kong|cathay/i.test(userMessage)) {
    return "At Hong Kong International, The Wing and The Pier are Cathay Pacific's flagship lounges (T1, Level 6). oneworld Sapphire gets you the Business Class lounge; Emerald gets First Class. Plaza Premium accepts Priority Pass at three locations across T1.";
  }

  // ── Walking / gate ──────────────────────────────────────────────────────────
  if (/\bgate\b|walk|distance|how far|portti|kävelyaika/i.test(userMessage)) {
    if (ctx.gate) {
      return isFinnish
        ? `Olet portilla ${ctx.gate}. Kävelyajat ovat näkyvissä sovelluksessa kunkin loungekortin yhteydessä.`
        : `You're at Gate ${ctx.gate}. Walking times are shown in the app for each lounge — check the lounge cards above.`;
    }
    return isFinnish
      ? 'Syötä porttinumero sovellukseen ja näytän arvioidut kävelyajat kuhunkin loungeen.'
      : "Enter your gate number in the app and I'll show walking time estimates to each lounge.";
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  if (ctx.allianceAccess && allianceName && ctx.airport) {
    return isFinnish
      ? `${ctx.airport}ssa voit käyttää ${allianceName} ${ctx.allianceAccess.tier} -statustasi kumppaniloungeihin. Kysy vaikka loungesta, fast trackista, ruuasta, juomista tai muista palveluista.`
      : `At ${ctx.airport}, use your ${allianceName} ${ctx.allianceAccess.tier} status to access partner lounges. Ask me specifically about lounges, fast track, food, drinks, or any other feature.`;
  }

  return isFinnish
    ? `Olen lentoasemaavustajasi${ctx.airport ? ` ${ctx.airport}ssa` : ''}. Kysy loungesta, fast trackista, samppanjasta, ruuasta, suihkutiloista tai muista matkavinkistä.`
    : `I'm your airport assistant${ctx.airport ? ` for ${ctx.airport}` : ''}. Ask me about lounges, fast track, champagne, food, showers, or any travel tip.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { messages: ChatMessage[]; context: ChatContext };
    const { messages, context } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    const lastMessage = messages[messages.length - 1]?.content ?? '';

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      return NextResponse.json({ reply: simulate(lastMessage, context) });
    }

    const systemPrompt = buildSystemPrompt(context);

    const geminiContents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    async function callGemini(): Promise<Response> {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    let geminiRes = await callGemini();

    if (!geminiRes.ok) {
      const status = geminiRes.status;

      // ── 400 invalid key ──────────────────────────────────────────────────────
      if (status === 400) {
        console.error('Gemini 400: invalid API key');
        return NextResponse.json({
          reply: '⚠️ AI unavailable — the Gemini API key is invalid. Check GEMINI_API_KEY in .env.local.',
        });
      }

      // ── 429 quota / rate-limit ───────────────────────────────────────────────
      if (status === 429) {
        type GeminiDetail = {
          '@type'?: string;
          retryDelay?: string;
          violations?: Array<{ quotaId?: string }>;
        };
        const errJson = await geminiRes.json().catch(() => null) as {
          error?: { details?: GeminiDetail[] };
        } | null;

        const details = errJson?.error?.details ?? [];
        const retryInfo = details.find((d) => d['@type']?.includes('RetryInfo'));
        const quotaInfo = details.find((d) => d['@type']?.includes('QuotaFailure'));
        const retryDelaySec = parseInt(retryInfo?.retryDelay?.replace('s', '') ?? '99', 10);
        const isDailyLimit = quotaInfo?.violations?.some((v) => v.quotaId?.includes('PerDay')) ?? false;

        if (!isDailyLimit && retryDelaySec <= 20) {
          // Per-minute limit and short wait — retry once after the suggested delay
          console.warn(`Gemini 429 per-minute limit; retrying in ${retryDelaySec}s…`);
          await new Promise((r) => setTimeout(r, retryDelaySec * 1000));
          geminiRes = await callGemini();
          if (geminiRes.ok) {
            // Successful retry — fall through to the normal response handling below
          } else {
            console.error('Gemini retry also failed');
            return NextResponse.json({
              reply: `⚠️ The AI assistant is rate-limited. Try again in ~${retryDelaySec} seconds. Your lounge access is shown in the cards above.`,
            });
          }
        } else if (isDailyLimit) {
          console.error('Gemini daily quota exhausted');
          return NextResponse.json({
            reply: '⚠️ The daily AI quota for this API key is exhausted and will reset tomorrow. Your lounge access is fully shown in the cards above — ask the Travel Assistant again tomorrow, or enable billing on ai.google.dev for unlimited access.',
          });
        } else {
          console.warn(`Gemini 429 per-minute limit; retry delay too long (${retryDelaySec}s)`);
          return NextResponse.json({
            reply: `⚠️ AI rate-limited — please wait ~${retryDelaySec} seconds and try again. Your lounge access is shown in the cards above.`,
          });
        }
      }

      if (!geminiRes.ok) {
        const err = await geminiRes.text().catch(() => '');
        console.error(`Gemini API error (${geminiRes.status}):`, err);
        return NextResponse.json({
          reply: '⚠️ AI assistant encountered an unexpected error. Your lounge access is shown in the cards above.',
        });
      }
    }

    const data = await geminiRes.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      simulate(lastMessage, context);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat route error:', err);
    return NextResponse.json(
      { reply: "Sorry, I couldn't process that. Try again in a moment." },
      { status: 500 },
    );
  }
}
