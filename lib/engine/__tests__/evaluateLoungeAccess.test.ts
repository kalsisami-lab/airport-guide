import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoungeAccess } from '../evaluateLoungeAccess';
import type { PassengerContext, StatusContext } from '../../normalization/types';
import type { ChannelInput, ExceptionInput, LoungeInput, RuleInput } from '../types';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const NOW_OPEN  = new Date('2025-05-16T10:00:00');  // within Daily 05:00–22:00
const NOW_EARLY = new Date('2025-05-16T03:30:00');  // before 05:00

function makePassenger(overrides: Partial<PassengerContext> = {}): PassengerContext {
  return {
    operatingCarrier:     'BA',
    marketingCarrier:     'BA',
    operatingAlliance:    'oneworld',
    cabin:                'economy',
    departureAirport:     'LHR',
    arrivalAirport:       'JFK',
    sameDayDeparture:     false,
    departureCountryCode: 'GB',
    ...overrides,
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

function makeRule(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    id:                 1,
    priority:           100,
    validFrom:          '2020-01-01',
    validTo:            null,
    confidence:         0.95,
    minAllianceTier:    null,
    carrierRestriction: null,
    conditions:         null,
    ...overrides,
  };
}

function makeChannel(
  channelType: ChannelInput['channelType'],
  allianceAccess: ChannelInput['allianceAccess'],
  rules: RuleInput[],
  id = 1,
): ChannelInput {
  return { id, channelType, allianceAccess, rules };
}

function makeLounge(overrides: Partial<LoungeInput> = {}): LoungeInput {
  return {
    id:           1,
    name:         'Test Lounge',
    terminalId:   5,
    openingHours: 'Daily 05:00–22:00',
    channels:     [],
    exceptions:   [],
    ...overrides,
  };
}

// ─── Spec scenarios ───────────────────────────────────────────────────────────

describe('evaluateLoungeAccess', () => {

  test('AY Gold + BA-lento LHR T5 economy → allowed, oneworld_sapphire-syyllä', () => {
    // Passenger: operating carrier BA (oneworld), status: AY Gold = oneworld_sapphire
    const passenger = makePassenger();                           // BA, oneworld
    const status    = makeStatus({ allianceTier: 'oneworld_sapphire' });
    const lounge = makeLounge({
      terminalId: 5,
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire' }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, {
      now: NOW_OPEN,
      passengerTerminalId: 5,
    });

    assert.equal(result.status, 'allowed');
    assert.ok(result.reason.includes('oneworld_sapphire'), `reason: ${result.reason}`);
    assert.ok(result.confidence > 0);
  });

  test('EK economy DXB, no status → denied', () => {
    const passenger = makePassenger({
      operatingCarrier:  'EK',
      marketingCarrier:  'EK',
      operatingAlliance: null,
      departureAirport:  'DXB',
      arrivalAirport:    'LHR',
    });
    // Lounge is a oneworld all_alliance lounge
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire' }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, null, lounge, { now: NOW_OPEN });

    assert.equal(result.status, 'denied');
  });

  test('LH Senator + LX-lento FRA → allowed, star_gold', () => {
    const passenger = makePassenger({
      operatingCarrier:     'LX',
      marketingCarrier:     'LX',
      operatingAlliance:    'star_alliance',
      departureAirport:     'FRA',
      arrivalAirport:       'ZRH',
      departureCountryCode: 'DE',
    });
    const status = makeStatus({
      allianceTier: 'star_gold',
      programCode:  'lh-miles-more',
      tierName:     'Senator',
    });
    const lounge = makeLounge({
      openingHours: 'Daily 05:30–22:30',
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'star_gold', confidence: 0.99 }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });

    assert.equal(result.status, 'allowed');
    assert.ok(result.reason.includes('star_gold'), `reason: ${result.reason}`);
  });

  test('blackout-poikkeus voittaa yleisen allow-säännön', () => {
    const passenger = makePassenger();
    const status    = makeStatus({ allianceTier: 'oneworld_sapphire' });
    const exception: ExceptionInput = {
      id:            99,
      exceptionType: 'blackout',
      priority:      500,   // higher than the allow rule's 100
      validFrom:     '2025-01-01',
      validTo:       null,
      confidence:    0.99,
      conditions:    null,  // always applies
      description:   'Lounge suljettu remontiksi',
    };
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire', priority: 100 }),
        ]),
      ],
      exceptions: [exception],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });

    assert.equal(result.status, 'denied');
    assert.ok(result.reason.includes('remontti') || result.reason.includes('suljettu') || result.reason.includes('Lounge suljettu'),
      `reason: ${result.reason}`);
    assert.ok(result.source.startsWith('exception:'));
  });

  test('suljettu lounge → closed', () => {
    const passenger = makePassenger();
    const status    = makeStatus();
    const lounge = makeLounge({
      openingHours: 'Daily 09:00–15:00',
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire' }),
        ]),
      ],
    });

    // 03:30 — before opening
    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_EARLY });

    assert.equal(result.status, 'closed');
    assert.ok(result.reason.includes('09:00'));
  });

  test('eri terminaali ilman airside-yhteyttä → physically_unreachable', () => {
    const passenger = makePassenger();
    const status    = makeStatus();
    const lounge = makeLounge({
      terminalId: 5,       // lounge in T5
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire' }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, {
      now: NOW_OPEN,
      passengerTerminalId: 2,   // passenger departs from T2
    });

    assert.equal(result.status, 'physically_unreachable');
  });

  // ─── Additional edge cases ─────────────────────────────────────────────────

  test('expired rule is ignored → denied', () => {
    const passenger = makePassenger();
    const status    = makeStatus({ allianceTier: 'oneworld_sapphire' });
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({
            minAllianceTier: 'oneworld_sapphire',
            validFrom: '2020-01-01',
            validTo:   '2022-12-31',  // expired before NOW_OPEN
          }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'denied');
  });

  test('carrier_specific channel: AY Emerald at AY-lounge → allowed', () => {
    const passenger = makePassenger({
      operatingCarrier:  'AY',
      marketingCarrier:  'AY',
      operatingAlliance: 'oneworld',
    });
    const status = makeStatus({ allianceTier: 'oneworld_emerald' });
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'carrier_specific', [
          makeRule({
            minAllianceTier:    'oneworld_emerald',
            carrierRestriction: ['AY'],
          }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'allowed');
  });

  test('carrier_specific channel: BA Emerald at AY-only lounge → denied', () => {
    const passenger = makePassenger({ operatingCarrier: 'BA' });
    const status    = makeStatus({ allianceTier: 'oneworld_emerald' });
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'carrier_specific', [
          makeRule({
            minAllianceTier:    'oneworld_emerald',
            carrierRestriction: ['AY'],
          }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'denied');
  });

  test('EK Skywards-tila (none) + oneworld lounge → denied', () => {
    const passenger = makePassenger({
      operatingCarrier:  'AY',
      operatingAlliance: 'oneworld',
    });
    const status = makeStatus({ allianceTier: 'none' });  // EK Skywards maps to none
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({ minAllianceTier: 'oneworld_sapphire' }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'denied');
  });

  test('EK Skywards + EK-lento + airline_own EK-lounge → allowed', () => {
    const passenger = makePassenger({
      operatingCarrier:  'EK',
      operatingAlliance: null,
    });
    const lounge = makeLounge({
      channels: [
        makeChannel('airline_own', null, [
          makeRule({ carrierRestriction: ['EK'] }),
        ]),
      ],
    });

    // Status irrelevant for airline_own
    const result = evaluateLoungeAccess(passenger, null, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'allowed');
  });

  test('paid channel only → paid_available', () => {
    const lounge = makeLounge({
      channels: [
        makeChannel('paid', null, [makeRule()], 2),
      ],
    });

    const result = evaluateLoungeAccess(makePassenger(), null, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'paid_available');
  });

  test('conditions predicate: same_day_departure=true blocks if passenger not same-day', () => {
    const passenger = makePassenger({ sameDayDeparture: false });
    const status    = makeStatus({ allianceTier: 'oneworld_sapphire' });
    const lounge = makeLounge({
      channels: [
        makeChannel('alliance_status', 'all_alliance', [
          makeRule({
            minAllianceTier: 'oneworld_sapphire',
            conditions: { op: 'same_day_departure', value: true },
          }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(passenger, status, lounge, { now: NOW_OPEN });
    assert.equal(result.status, 'denied');
  });

  test('24 hours lounge is never closed', () => {
    const lounge = makeLounge({
      openingHours: '24 hours',
      channels: [
        makeChannel('airline_own', null, [
          makeRule({ carrierRestriction: ['BA'] }),
        ]),
      ],
    });

    const result = evaluateLoungeAccess(makePassenger(), null, lounge, { now: NOW_EARLY });
    // 03:30 — would be closed if not 24 hours
    assert.notEqual(result.status, 'closed');
    assert.equal(result.status, 'allowed');
  });
});
