/**
 * §64 — Tier-hierarchy deny for alliance_defined service rules.
 *
 *   T1  No status + LHR fast_track (alliance_defined sapphire) → denied
 *       Rule authoritatively requires Sapphire; no-status pax can't have it.
 *   T2  Sapphire + LH-flight + LHR (alliance_defined) → not_enough_info
 *       Carrier miss (LH not on list, or if it were, wrong alliance) —
 *       NOT a tier miss. Rule silent about non-oneworld carriers.
 *   T3  Sapphire + no-carrier-restriction + oneworld_ruby rule → still allowed
 *       Ruby-floor rule, Sapphire meets ≥ ruby.
 *   T4  Ruby + lounge rule (tierSemantics = 'local') → NOT denied
 *       Lounges use local semantics — tier miss ≠ certainty. Same tier
 *       miss on a local rule falls through to not_enough_info. Separate
 *       from LHR fast_track which is alliance_defined.
 *   T5  Ruby + local rule (cabin-only, no min_tier) + LHR fast_track →
 *       cabin-only rule doesn't miss on tier. Not tier deny; falls back.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAirportService } from '../airport-services/evaluateAirportService';
import type { PassengerContext, StatusContext, AllianceTier } from '../normalization/types';
import type { AirportServiceRuleInput } from '../airport-services/types';

const NOW = new Date('2026-07-23T12:00:00');

function makePassenger(o: Partial<PassengerContext> = {}): PassengerContext {
  return { operatingCarrier: 'AY', marketingCarrier: 'AY', operatingAlliance: 'oneworld',
    cabin: 'business', departureAirport: 'LHR', arrivalAirport: 'HEL',
    sameDayDeparture: false, departureCountryCode: 'GB', arrivalCountryCode: 'FI',
    arrivalIsSchengen: true, passengerZone: null, ...o };
}
function makeStatus(t: AllianceTier): StatusContext { return { allianceTier: t, programCode: 'test', tierName: t, fastTrack: false }; }

function makeServiceRule(o: Partial<AirportServiceRuleInput> = {}): AirportServiceRuleInput {
  return { id: 100, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.95,
    minAllianceTier: null, carrierRestriction: null, conditions: null,
    provider: null, action: 'allow', notes: null, tierSemantics: 'alliance_defined', ...o };
}

const CARRIERS = ['BA', 'IB', 'AA', 'CX', 'QF', 'JL', 'QR', 'AY'];
const LHR_FastTrack = () => makeServiceRule({
  id: 4, minAllianceTier: 'oneworld_sapphire', carrierRestriction: CARRIERS,
  tierSemantics: 'alliance_defined',
});


describe('§64 — tier-hierarchy deny for alliance_defined rules', () => {

  test('T1: no status + LHR fast_track (alliance_defined sapphire) → DENIED (§64: authoritative tier requirement, no-status = below tier)', () => {
    const p = makePassenger();
    const r = evaluateAirportService(p, null, 'fast_track_security', [LHR_FastTrack()], NOW);
    assert.equal(r.status, 'denied');
    assert.equal(r.confidence, 0.9);
  });

  test('T2: Sapphire + LH-flight (non-oneworld carrier) + LHR → not_enough_info (§64: carrier miss ≠ tier miss)', () => {
    const p = makePassenger({ operatingCarrier: 'LH', marketingCarrier: 'LH', operatingAlliance: 'star_alliance' });
    const r = evaluateAirportService(p, makeStatus('oneworld_sapphire'), 'fast_track_security', [LHR_FastTrack()], NOW);
    // LH not on carrier list → carrier_not_on_list miss reason → not tier miss → NOT denied
    assert.equal(r.status, 'not_enough_info');
  });

  test('T3: Sapphire + AY + oneworld_ruby-floor rule → allowed (Sapphire ≥ Ruby)', () => {
    const p = makePassenger();
    const rubyRule = makeServiceRule({ minAllianceTier: 'oneworld_ruby', carrierRestriction: ['AY'], tierSemantics: 'alliance_defined' });
    const r = evaluateAirportService(p, makeStatus('oneworld_sapphire'), 'fast_track_security', [rubyRule], NOW);
    assert.equal(r.status, 'allowed');
  });

  test('T4: Ruby + airport service rule with tierSemantics="local" + tier miss → NOT denied (§64 opt-in: local rules fall through to not_enough_info on tier miss)', () => {
    // A local rule requiring Sapphire — Ruby doesn't meet it, but tierSemantics='local'
    // means the miss is NOT authoritative. Falls back to not_enough_info.
    // This is the "airport may have other paths we haven't modeled" default.
    const p = makePassenger();
    const localRule = makeServiceRule({
      minAllianceTier: 'oneworld_sapphire',
      carrierRestriction: ['AY'],
      tierSemantics: 'local',  // ← explicitly opt out of §64 tier deny
    });
    const r = evaluateAirportService(p, makeStatus('oneworld_ruby'), 'fast_track_security', [localRule], NOW);
    assert.equal(r.status, 'not_enough_info');
  });

  test('T5: statuksetön + cabin-only rule (local) → cabin match → allowed via cabin path (§64 tier deny NOT triggered on local rules)', () => {
    // Cabin-only rule with tierSemantics='local' — matches business cabin regardless
    // of tier. Should NOT trigger §64 tier deny because rule has no min_alliance_tier.
    const cabinRule = makeServiceRule({
      minAllianceTier: null,
      conditions: { op: 'in', field: 'passenger.cabin', values: ['business', 'first'] },
      tierSemantics: 'local',
    });
    const p = makePassenger({ cabin: 'business' });
    const r = evaluateAirportService(p, null, 'fast_track_security', [cabinRule], NOW);
    assert.equal(r.status, 'allowed');
  });
});
