import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAirportService } from '../evaluateAirportService';
import { findAirportServices } from '../findAirportServices';
import type { PassengerContext, StatusContext } from '../../normalization/types';
import type { AirportServiceRuleInput, ServiceType } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2025-05-16T10:00:00');
const PAST_DEP = '2025-05-16T08:00:00';   // departure already happened
const FUTURE_DEP = '2025-05-16T14:00:00'; // departure still ahead

function makePassenger(overrides: Partial<PassengerContext> & { departureTime?: string } = {}): PassengerContext {
  const { departureTime, ...rest } = overrides;
  return {
    operatingCarrier:     'AY',
    marketingCarrier:     'AY',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'HEL',
    arrivalAirport:       'FRA',
    sameDayDeparture:     false,
    departureCountryCode: 'FI',
    departureTime,
    ...rest,
  };
}

function makeStatus(overrides: Partial<StatusContext> = {}): StatusContext {
  return {
    allianceTier: 'oneworld_sapphire',
    programCode:  'ay-plus',
    tierName:     'Gold',
    fastTrack:    true,
    ...overrides,
  };
}

function makeRule(overrides: Partial<AirportServiceRuleInput> = {}): AirportServiceRuleInput {
  return {
    id:                 1,
    priority:           100,
    validFrom:          '2020-01-01',
    validTo:            null,
    confidence:         0.95,
    action:             'allow',
    minAllianceTier:    'oneworld_sapphire',
    carrierRestriction: null,
    conditions:         null,
    provider:           null,
    notes:              null,
    ...overrides,
  };
}

// ─── 1–3: Tarjonta ────────────────────────────────────────────────────────────

describe('Tarjonta', () => {
  test('1. Ei sääntöjä → not_offered_at_airport', () => {
    const r = evaluateAirportService(makePassenger(), makeStatus(), 'fast_track_security', [], NOW);
    assert.equal(r.status, 'not_offered_at_airport');
    assert.ok(r.reason.length > 0);
  });

  test('2. Säännöt olemassa → arvioidaan normaalisti (ei not_offered)', () => {
    const r = evaluateAirportService(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire' }),
      'priority_boarding',
      [makeRule({ minAllianceTier: 'oneworld_sapphire' })],
      NOW,
    );
    assert.notEqual(r.status, 'not_offered_at_airport');
  });

  test('3. findAirportServices palauttaa kaikki neljä palvelua', () => {
    const result = findAirportServices(
      makePassenger(),
      makeStatus(),
      'HEL',
      {
        fast_track_security: [makeRule()],
        priority_checkin:    [makeRule()],
        priority_boarding:   [makeRule()],
        priority_baggage:    [makeRule()],
      },
      NOW,
    );
    assert.ok('fast_track_security' in result.services);
    assert.ok('priority_checkin'    in result.services);
    assert.ok('priority_boarding'   in result.services);
    assert.ok('priority_baggage'    in result.services);
    assert.equal(result.airportIata, 'HEL');
  });
});

// ─── 4–6: Sovellettavuus ──────────────────────────────────────────────────────

describe('Sovellettavuus', () => {
  test('4. priority_boarding + lähtö jo menneisyydessä → not_applicable', () => {
    const r = evaluateAirportService(
      makePassenger({ departureTime: PAST_DEP }),
      makeStatus(),
      'priority_boarding',
      [makeRule()],
      NOW,
    );
    assert.equal(r.status, 'not_applicable');
  });

  test('5. priority_boarding + lähtö tulevaisuudessa → arvioidaan normaalisti', () => {
    const r = evaluateAirportService(
      makePassenger({ departureTime: FUTURE_DEP }),
      makeStatus({ allianceTier: 'oneworld_sapphire' }),
      'priority_boarding',
      [makeRule({ minAllianceTier: 'oneworld_sapphire' })],
      NOW,
    );
    assert.notEqual(r.status, 'not_applicable');
    assert.equal(r.status, 'allowed');
  });

  test('6. fast_track_security ennen turvatarkastusta → arvioidaan normaalisti', () => {
    const r = evaluateAirportService(
      makePassenger({ departureTime: FUTURE_DEP }),
      makeStatus({ allianceTier: 'oneworld_sapphire' }),
      'fast_track_security',
      [makeRule()],
      NOW,
    );
    assert.notEqual(r.status, 'not_applicable');
  });
});

// ─── 7–11: Status-pohjainen pääsy ─────────────────────────────────────────────

describe('Status-pohjainen pääsy', () => {
  test('7. AY Platinum (emerald) + AY HEL → kaikki neljä allowed', () => {
    const pax    = makePassenger({ operatingCarrier: 'AY' });
    const status = makeStatus({ allianceTier: 'oneworld_emerald', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'oneworld_sapphire' }); // emerald > sapphire

    const services: Record<ServiceType, AirportServiceRuleInput[]> = {
      fast_track_security: [rule],
      priority_checkin:    [rule],
      priority_boarding:   [rule],
      priority_baggage:    [rule],
    };
    const result = findAirportServices(pax, status, 'HEL', services, NOW);

    for (const [svc, res] of Object.entries(result.services)) {
      assert.equal(res.status, 'allowed', `${svc} should be allowed`);
    }
  });

  test('8. AY Gold (sapphire) + fast_track requires emerald → denied, boarding/baggage allowed', () => {
    const pax    = makePassenger();
    const status = makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true });

    const result = findAirportServices(pax, status, 'HEL', {
      fast_track_security: [makeRule({ minAllianceTier: 'oneworld_emerald' })], // sapphire nie riitä
      priority_checkin:    [makeRule({ minAllianceTier: 'oneworld_sapphire' })],
      priority_boarding:   [makeRule({ minAllianceTier: 'oneworld_sapphire' })],
      priority_baggage:    [makeRule({ minAllianceTier: 'oneworld_sapphire' })],
    }, NOW);

    assert.equal(result.services.fast_track_security.status, 'denied');
    assert.equal(result.services.priority_boarding.status, 'allowed');
    assert.equal(result.services.priority_baggage.status, 'allowed');
  });

  test('9. LH Senator + LH FRA → kaikki neljä allowed', () => {
    const pax    = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'star_gold' });

    const result = findAirportServices(pax, status, 'FRA', {
      fast_track_security: [rule],
      priority_checkin:    [rule],
      priority_boarding:   [rule],
      priority_baggage:    [rule],
    }, NOW);

    for (const [svc, res] of Object.entries(result.services)) {
      assert.equal(res.status, 'allowed', `${svc} should be allowed`);
    }
  });

  test('10. LH Senator + LX FRA → kaikki neljä allowed (star-lento riittää)', () => {
    const pax    = makePassenger({ operatingCarrier: 'LX', operatingAlliance: 'star_alliance' });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'star_gold' }); // no carrierRestriction

    const result = findAirportServices(pax, status, 'FRA', {
      fast_track_security: [rule],
      priority_checkin:    [rule],
      priority_boarding:   [rule],
      priority_baggage:    [rule],
    }, NOW);

    for (const [svc, res] of Object.entries(result.services)) {
      assert.equal(res.status, 'allowed', `${svc} should be allowed for LX star_gold`);
    }
  });

  test('11. LH Senator + U2 STN (alliance=null) → kaikki denied', () => {
    const pax    = makePassenger({ operatingCarrier: 'U2', operatingAlliance: null });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'star_gold' }); // alliance check blocks null

    const result = findAirportServices(pax, status, 'STN', {
      fast_track_security: [rule],
      priority_checkin:    [rule],
      priority_boarding:   [rule],
      priority_baggage:    [rule],
    }, NOW);

    for (const [svc, res] of Object.entries(result.services)) {
      assert.equal(res.status, 'denied', `${svc} should be denied for null-alliance flight`);
    }
  });
});

// ─── 12–13: Provider-erottelu ─────────────────────────────────────────────────

describe('Provider-erottelu', () => {
  test('12. star_gold + kaksi allow-sääntöä → korkein priority voittaa, reason mainitsee providerin', () => {
    const pax    = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });

    const goldTrack = makeRule({
      id: 2, priority: 200, provider: 'star_alliance_gold_track',
      minAllianceTier: 'star_gold', confidence: 0.98,
    });
    const generic = makeRule({
      id: 1, priority: 100, provider: 'airline_own',
      minAllianceTier: 'star_gold', confidence: 0.90,
    });

    const r = evaluateAirportService(pax, status, 'fast_track_security', [generic, goldTrack], NOW);
    assert.equal(r.status, 'allowed');
    assert.equal(r.confidence, 0.98, 'Highest-priority rule used');
    assert.ok(r.reason.includes('star_alliance_gold_track'), 'Provider named in reason');
  });

  test('13. AY Gold + BA LHR → reason kertoo oneworld_sapphire', () => {
    const pax    = makePassenger({ operatingCarrier: 'BA', operatingAlliance: 'oneworld' });
    const status = makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'oneworld_sapphire', provider: 'ba_first_wing' });

    const r = evaluateAirportService(pax, status, 'fast_track_security', [rule], NOW);
    assert.equal(r.status, 'allowed');
    assert.ok(r.reason.includes('oneworld_sapphire'));
  });
});

// ─── 14–15: Lippuluokka ───────────────────────────────────────────────────────

describe('Lippuluokka', () => {
  test('14. First-luokka → priority_checkin/boarding/baggage allowed cabin-säännöllä', () => {
    const pax = makePassenger({ cabin: 'first', operatingCarrier: 'AY', operatingAlliance: 'oneworld' });
    const cabinRule = makeRule({
      minAllianceTier: null,
      conditions: { op: 'equals', field: 'passenger.cabin', value: 'first' },
    });

    for (const svc of ['priority_checkin', 'priority_boarding', 'priority_baggage'] as ServiceType[]) {
      const r = evaluateAirportService(pax, null, svc, [cabinRule], NOW);
      assert.equal(r.status, 'allowed', `${svc} should be allowed for first class`);
    }
  });

  test('15. Business-luokka + Star Gold Track sääntö vaatii star_gold → ei cabin-perusteella', () => {
    const pax = makePassenger({
      cabin: 'business', operatingCarrier: 'LH', operatingAlliance: 'star_alliance',
    });
    const goldTrackRule = makeRule({
      minAllianceTier: 'star_gold', provider: 'star_alliance_gold_track',
    });
    // Business class without star_gold status → denied
    const r = evaluateAirportService(pax, null, 'fast_track_security', [goldTrackRule], NOW);
    assert.equal(r.status, 'denied');
  });
});

// ─── 16: Allianssiraja ────────────────────────────────────────────────────────

describe('Allianssiraja', () => {
  test('16. star_gold + oneworld-lento + oneworld-sääntö → denied (eri alianssi)', () => {
    const pax    = makePassenger({ operatingCarrier: 'BA', operatingAlliance: 'oneworld' });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'oneworld_sapphire' }); // oneworld vaatimus

    const r = evaluateAirportService(pax, status, 'fast_track_security', [rule], NOW);
    assert.equal(r.status, 'denied', 'star_gold cannot satisfy oneworld_sapphire');
  });
});

// ─── 17: Deny voittaa allow ───────────────────────────────────────────────────

describe('Deny voittaa allow', () => {
  test('17. Deny-sääntö korkein priority → denied vaikka allow-sääntö täsmää', () => {
    const pax    = makePassenger({ operatingCarrier: 'RY', operatingAlliance: 'oneworld' });
    const status = makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true });

    const denyRule = makeRule({
      id: 2, priority: 500, action: 'deny',
      carrierRestriction: ['RY'], minAllianceTier: null,
    });
    const allowRule = makeRule({
      id: 1, priority: 100, action: 'allow',
      minAllianceTier: 'oneworld_sapphire',
    });

    const r = evaluateAirportService(pax, status, 'fast_track_security', [allowRule, denyRule], NOW);
    assert.equal(r.status, 'denied', 'Deny rule must override allow');
  });
});

// ─── 18–19: Maksullinen ───────────────────────────────────────────────────────

describe('Maksullinen', () => {
  test('18. Ei statusta + paid-provider → paid_available', () => {
    const rule = makeRule({ minAllianceTier: null, provider: 'paid', action: 'allow' });
    const r = evaluateAirportService(makePassenger(), null, 'fast_track_security', [rule], NOW);
    assert.equal(r.status, 'paid_available');
  });

  test('19. Status täsmää + paid-provider olemassa → allowed (status voittaa paid)', () => {
    const statusRule = makeRule({
      id: 1, priority: 100, minAllianceTier: 'oneworld_sapphire', provider: null,
    });
    const paidRule = makeRule({
      id: 2, priority: 50, minAllianceTier: null, provider: 'paid',
    });
    const r = evaluateAirportService(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true }),
      'fast_track_security',
      [statusRule, paidRule],
      NOW,
    );
    assert.equal(r.status, 'allowed');
  });
});

// ─── 20–22: Aggregointi ───────────────────────────────────────────────────────

describe('Aggregointi (findAirportServices)', () => {
  test('20. LH Senator + LH FRA → neljä avainta, jokaisella oma AccessResult', () => {
    const pax    = makePassenger({ operatingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const status = makeStatus({ allianceTier: 'star_gold', fastTrack: true });
    const rule   = makeRule({ minAllianceTier: 'star_gold' });

    const result = findAirportServices(pax, status, 'FRA', {
      fast_track_security: [rule],
      priority_checkin:    [rule],
      priority_boarding:   [rule],
      priority_baggage:    [rule],
    }, NOW);

    assert.equal(Object.keys(result.services).length, 4);
    for (const res of Object.values(result.services)) {
      assert.ok('status' in res && 'confidence' in res && 'reason' in res);
    }
  });

  test('21. Sekamatkustaja: yksi allowed, kolme denied → selkeä palautus', () => {
    const result = findAirportServices(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true }),
      'HEL',
      {
        fast_track_security: [makeRule({ minAllianceTier: 'oneworld_emerald' })], // sapphire ei riitä
        priority_checkin:    [makeRule({ minAllianceTier: 'oneworld_emerald' })],
        priority_boarding:   [makeRule({ minAllianceTier: 'oneworld_sapphire' })], // riittää
        priority_baggage:    [makeRule({ minAllianceTier: 'oneworld_emerald' })],
      },
      NOW,
    );

    assert.equal(result.services.priority_boarding.status, 'allowed');
    assert.equal(result.services.fast_track_security.status, 'denied');
    assert.equal(result.services.priority_checkin.status, 'denied');
    assert.equal(result.services.priority_baggage.status, 'denied');
  });

  test('22. Kenttä jossa vain kaksi palvelua → kaksi allowed/denied + kaksi not_offered', () => {
    const result = findAirportServices(
      makePassenger(),
      makeStatus({ allianceTier: 'oneworld_sapphire', fastTrack: true }),
      'JFK',
      {
        fast_track_security: [],              // ei tarjolla
        priority_checkin:    [],              // ei tarjolla
        priority_boarding:   [makeRule()],    // tarjolla
        priority_baggage:    [makeRule()],    // tarjolla
      },
      NOW,
    );

    assert.equal(result.services.fast_track_security.status, 'not_offered_at_airport');
    assert.equal(result.services.priority_checkin.status, 'not_offered_at_airport');
    assert.notEqual(result.services.priority_boarding.status, 'not_offered_at_airport');
    assert.notEqual(result.services.priority_baggage.status, 'not_offered_at_airport');
  });
});

// ─── 23–25: Yhteensopivuus ja determinismi ────────────────────────────────────

describe('Yhteensopivuus ja determinismi', () => {
  test('23. evaluateAirportService käyttää samaa evalCondition-moduulia kuin lounge', () => {
    // Testataan that conditions evaluate correctly — same predicate module
    const rule = makeRule({
      minAllianceTier: 'oneworld_sapphire',
      conditions: { op: 'same_day_departure', value: true },
    });
    const paxSameDay = makePassenger({ sameDayDeparture: true });
    const paxOther   = makePassenger({ sameDayDeparture: false });
    const status     = makeStatus();

    const r1 = evaluateAirportService(paxSameDay, status, 'fast_track_security', [rule], NOW);
    const r2 = evaluateAirportService(paxOther,   status, 'fast_track_security', [rule], NOW);

    assert.equal(r1.status, 'allowed',  'same_day_departure=true matches');
    assert.equal(r2.status, 'denied', 'same_day_departure=false blocks');
  });

  test('24. AccessStatus-laajennukset eivät riko lounge-sorttausta', () => {
    // STATUS_SORT kattaa nyt myös not_offered ja not_applicable
    const { STATUS_SORT } = require('../../entitlements/types');
    assert.ok(typeof STATUS_SORT.not_offered_at_airport === 'number');
    assert.ok(typeof STATUS_SORT.not_applicable         === 'number');
    assert.ok(STATUS_SORT.not_offered_at_airport > STATUS_SORT.denied);
  });

  test('25. Determinismi: sama input → sama output 50 kertaa', () => {
    const pax    = makePassenger();
    const status = makeStatus();
    const rules  = [makeRule(), makeRule({ id: 2, priority: 50, minAllianceTier: 'oneworld_emerald' })];
    const first  = evaluateAirportService(pax, status, 'fast_track_security', rules, NOW);
    for (let i = 0; i < 49; i++) {
      const r = evaluateAirportService(pax, status, 'fast_track_security', rules, NOW);
      assert.deepEqual(r, first);
    }
  });
});
