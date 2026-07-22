/**
 * Quick DOM inspector — dumps the structure of the lounge results page
 * so we can figure out how lounge cards vs boilerplate are marked up.
 */
import { chromium } from 'playwright';

async function main() {
  const iata = process.argv[2] || 'MAD';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`https://www.oneworld.com/airport-lounge-results?location=${iata}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  // Dump the outerHTML of anything that looks like a lounge card
  const dump = await page.evaluate(() => {
    const uniqueClassPatterns = new Set<string>();
    const all = document.querySelectorAll('main *');
    all.forEach(el => {
      const c = (el.className || '').toString();
      c.split(/\s+/).forEach(cls => {
        if (/lounge|Lounge|LOUNGE/.test(cls)) uniqueClassPatterns.add(cls);
      });
    });

    // For each unique lounge-ish class, dump one example's HTML (truncated)
    const samples: Record<string, string> = {};
    for (const cls of uniqueClassPatterns) {
      const el = document.querySelector(`.${CSS.escape(cls)}`);
      if (el) samples[cls] = (el.outerHTML || '').slice(0, 1500);
    }

    // Also grab the primary results container structure
    const containerCandidates = [
      'main [class*="lounge-results"]',
      'main [class*="LoungeResults"]',
      'main [class*="results-list"]',
      'main [class*="results"]',
    ];
    const containers: Record<string, string> = {};
    for (const sel of containerCandidates) {
      const el = document.querySelector(sel);
      if (el) {
        // Get children structure summary
        const children = Array.from(el.children).slice(0, 3).map(c => ({
          tag: c.tagName,
          class: (c.className || '').toString().slice(0, 80),
          textPreview: (c.textContent || '').slice(0, 80),
        }));
        containers[sel] = JSON.stringify(children, null, 2);
      }
    }

    return { uniqueClassPatterns: Array.from(uniqueClassPatterns), samples, containers };
  });

  console.log('=== unique lounge-ish classes ===');
  console.log(dump.uniqueClassPatterns);
  console.log('\n=== container structure ===');
  console.log(dump.containers);
  console.log('\n=== samples ===');
  for (const [cls, html] of Object.entries(dump.samples)) {
    console.log(`\n--- .${cls} ---`);
    console.log(html);
  }

  await browser.close();
}

main();
