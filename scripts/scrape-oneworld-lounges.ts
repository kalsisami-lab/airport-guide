/**
 * scrape-oneworld-lounges.ts
 *
 * Renders oneworld.com's per-airport lounge finder in headless Chromium
 * and extracts structured lounge data. The site's SPA populates the DOM
 * using classes .lounges-list .lounge, so we can walk that tree
 * deterministically once the render finishes.
 *
 * Output: scripts/output/oneworld-lounges.json (indexed by IATA code).
 *
 * Usage:
 *   npx tsx scripts/scrape-oneworld-lounges.ts MAD             # single IATA
 *   npx tsx scripts/scrape-oneworld-lounges.ts MAD LHR CDG     # multiple
 *   npx tsx scripts/scrape-oneworld-lounges.ts --file iatas.txt
 *
 * The scraper preserves the seasonal-snapshot problem noted in §36 —
 * carriers absent from the snapshot are absent from the output. Every
 * output row still needs human §36 review before seeding.
 */
import { chromium, type Page } from 'playwright';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const OUTPUT = path.join(process.cwd(), 'scripts/output/oneworld-lounges.json');
const BASE_URL = 'https://www.oneworld.com/airport-lounge-results?location=';
const NAV_TIMEOUT_MS = 20_000;
const RENDER_WAIT_MS = 4_000;
const PER_AIRPORT_PAUSE_MS = 800;

interface LoungeRecord {
  name:         string;
  subtitle:     string | null;              // page-provided "airport (IATA) terminal" line
  location:     string | null;              // detailed location text
  tiers:        string[];                   // ['sapphire', 'emerald']
  carrierNames: string[];                   // as shown on page ("British Airways", ...)
  carriers:     string[];                   // mapped IATA codes ("BA", "AY", ...)
  unmappedCarrierNames: string[];           // page-listed carriers we couldn't map
  amenities:    string[];
  openingHours: Record<string, string[]>;   // { Monday: ['06:00 - 23:00'], ... }
  zone:         'schengen' | 'non_schengen' | null;
  disclaimer:   string | null;
  // §51 wording captured verbatim from `.lounge-details__airlines li.conditions`.
  // Two canonical values seen so far:
  //   "Access for eligible customers traveling on any oneworld member airline."   → Ryhmä 2 all_alliance
  //   "Access for eligible customers traveling on these oneworld member airlines only." → Ryhmä 1 carrier_specific
  // Any other wording (or null) means the page structure changed and needs manual review.
  accessPolicyText: string | null;
}

interface AirportRecord {
  iata:        string;
  loungeCount: number;
  lounges:     LoungeRecord[];
  fetchedAt:   string;
  error?:      string;
}

// oneworld member airline name → IATA carrier code mapping.
// Used inside the browser context, so kept as an inline object at
// evaluate-time to avoid serialization boundary quirks.
const CARRIER_MAP_SOURCE = `{
  'American Airlines':    'AA',
  'British Airways':      'BA',
  'Cathay Pacific':       'CX',
  'Finnair':              'AY',
  'Iberia':               'IB',
  'Japan Airlines':       'JL',
  'Malaysia Airlines':    'MH',
  'Qantas':               'QF',
  'Qatar Airways':        'QR',
  'Royal Air Maroc':      'AT',
  'Royal Jordanian':      'RJ',
  'SriLankan Airlines':   'UL',
  'Alaska Airlines':      'AS',
  'Fiji Airways':         'FJ',
  'Oman Air':             'WY',
}`;

async function extractLoungesFromPage(page: Page): Promise<LoungeRecord[]> {
  // Inline the extractor as a plain JS function string to sidestep the
  // tsx `__name` helper injection that breaks page.evaluate callbacks.
  const extractorSource = `
    (function(carrierMapJson) {
      var CARRIERS = eval('(' + carrierMapJson + ')');
      function clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }

      var cards = Array.from(document.querySelectorAll('.lounges-list .lounge'));
      return cards.map(function(card) {
        var titleEl = card.querySelector('.lounge__title');
        var subtitleEl = card.querySelector('.lounge__subtitle');
        var locEl = card.querySelector('.lounge__location .lounge-additional__section-content');

        var name = clean(titleEl && titleEl.textContent);
        var subtitle = clean(subtitleEl && subtitleEl.textContent) || null;
        var location = clean(locEl && locEl.textContent) || null;

        var tiers = Array.from(card.querySelectorAll('.lounge__tier-label'))
          .map(function(el) { return clean(el.textContent).toLowerCase(); })
          .filter(Boolean);

        var carrierEls = Array.from(
          card.querySelectorAll('.lounge-details__airlines ul li:not(.conditions)')
        );
        var carrierNames = carrierEls.map(function(el) { return clean(el.textContent); }).filter(Boolean);
        var carriers = [];
        var unmappedCarrierNames = [];
        for (var i = 0; i < carrierNames.length; i++) {
          var cn = carrierNames[i];
          var code = CARRIERS[cn];
          if (code) carriers.push(code); else unmappedCarrierNames.push(cn);
        }

        var amenities = Array.from(card.querySelectorAll('.lounge-amenities__item[data-name]'))
          .map(function(el) { return (el.getAttribute('data-name') || '').replace(/^Amenities-/, ''); })
          .filter(Boolean);

        var openingHours = {};
        var dayEls = Array.from(card.querySelectorAll('.lounge__opening-hours .lounge-openining-hours__day'));
        for (var j = 0; j < dayEls.length; j++) {
          var dayEl = dayEls[j];
          var dayTitleEl = dayEl.querySelector('.lounge-opening-hours__day-title');
          var dayName = clean(dayTitleEl && dayTitleEl.textContent);
          var slots = Array.from(dayEl.querySelectorAll('.lounge-opening-hours__time-slot'))
            .map(function(s) { return clean(s.textContent); })
            .filter(Boolean);
          if (dayName) openingHours[dayName] = slots;
        }

        var zoneSrc = ((location || '') + ' ' + (subtitle || '')).toLowerCase();
        var zone = null;
        if (/non[- ]schengen/.test(zoneSrc))    zone = 'non_schengen';
        else if (/schengen/.test(zoneSrc))       zone = 'schengen';

        var discEl = card.querySelector('.lounge__disclaimer');
        var disclaimer = clean(discEl && discEl.textContent) || null;

        // §51 wording: read from li.conditions inside the airlines block.
        var apEl = card.querySelector('.lounge-details__airlines li.conditions');
        var accessPolicyText = clean(apEl && apEl.textContent) || null;

        return {
          name: name,
          subtitle: subtitle,
          location: location,
          tiers: Array.from(new Set(tiers)),
          carrierNames: carrierNames,
          carriers: carriers,
          unmappedCarrierNames: unmappedCarrierNames,
          amenities: amenities,
          openingHours: openingHours,
          zone: zone,
          disclaimer: disclaimer,
          accessPolicyText: accessPolicyText,
        };
      });
    })
  `;
  // Pass extractor source + carrier map as a single JS expression string.
  // Playwright accepts a string that is evaluated verbatim in the page — no
  // callback wrapping, so no tsx `__name` injection to worry about.
  const wireExpression = `(${extractorSource})(${JSON.stringify(CARRIER_MAP_SOURCE)})`;
  return await page.evaluate(wireExpression) as LoungeRecord[];
}

async function scrapeOne(page: Page, iata: string): Promise<AirportRecord> {
  const rec: AirportRecord = {
    iata,
    loungeCount: 0,
    lounges: [],
    fetchedAt: new Date().toISOString(),
  };
  try {
    await page.goto(BASE_URL + iata, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    // Wait for either .lounges-list .lounge OR .lounges-list__no-results
    await page.waitForSelector('.lounges-list .lounge, .lounges-list__no-results', {
      timeout: NAV_TIMEOUT_MS,
    }).catch(() => { /* fall through and let extract return empty */ });
    // Small settle time in case cards render in stages
    await page.waitForTimeout(RENDER_WAIT_MS);

    const noResults = await page.locator('.lounges-list__no-results').first().isVisible().catch(() => false);
    if (noResults) {
      rec.error = 'no_lounges_reported';
      return rec;
    }

    rec.lounges = await extractLoungesFromPage(page);
    rec.loungeCount = rec.lounges.length;
  } catch (e) {
    rec.error = String(e).slice(0, 200);
  }
  return rec;
}

async function loadIataList(): Promise<string[]> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/scrape-oneworld-lounges.ts <IATA> [<IATA>...] | --file <path>');
    process.exit(1);
  }
  if (args[0] === '--file') {
    const p = args[1];
    if (!p) { console.error('--file requires a path'); process.exit(1); }
    const raw = await fs.readFile(p, 'utf-8');
    return raw
      .split('\n')
      .map((l) => l.trim().toUpperCase())
      .filter((l) => /^[A-Z]{3}$/.test(l));
  }
  return args
    .map((a) => a.trim().toUpperCase())
    .filter((a) => /^[A-Z]{3}$/.test(a));
}

async function main() {
  const iatas = await loadIataList();
  console.log(`Scraping ${iatas.length} airport(s): ${iatas.join(', ')}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const out: Record<string, AirportRecord> = {};
  for (const iata of iatas) {
    process.stdout.write(`  ${iata} ... `);
    const rec = await scrapeOne(page, iata);
    out[iata] = rec;
    if (rec.error) {
      console.log(`ERROR: ${rec.error}`);
    } else {
      const unmapped = new Set<string>();
      rec.lounges.forEach((l) => l.unmappedCarrierNames.forEach((n) => unmapped.add(n)));
      const unmappedNote = unmapped.size > 0 ? `  [unmapped carriers: ${Array.from(unmapped).join(', ')}]` : '';
      console.log(`${rec.loungeCount} lounge(s)${unmappedNote}`);
    }
    await page.waitForTimeout(PER_AIRPORT_PAUSE_MS);
  }

  await browser.close();

  // Merge with existing output if present (idempotent-ish per IATA)
  let existing: Record<string, AirportRecord> = {};
  try {
    const raw = await fs.readFile(OUTPUT, 'utf-8');
    existing = JSON.parse(raw);
  } catch { /* first run */ }
  const merged = { ...existing, ...out };

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`\nWrote ${Object.keys(merged).length} airport records → ${OUTPUT}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
