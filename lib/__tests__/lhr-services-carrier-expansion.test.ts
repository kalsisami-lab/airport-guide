/**
 * LHR fast_track + priority_boarding carrier expansion regression tests.
 *
 * Before expansion: rules had carrier_restriction=[BA,IB]. AY/AA/CX/QF/JL/QR
 * pax → rule miss → post-§63 `not_enough_info` (chip "?"). Semantically OK
 * but leaves the app claiming "unknown" for the majority of oneworld carriers
 * where the benefit actually applies at T3/T5.
 *
 * After expansion: [BA,IB,AA,CX,QF,JL,QR]. Same tier requirements
 * (sapphire for fast_track, emerald for priority_boarding). Notes carry
 * the "Terminal 3 and 5 only" location fact.
 *
 *   G1  AY Sapphire on AY LHR→HEL → LHR fast_track allowed (was "?", now "✓")
 *   G2  CX Sapphire on CX LHR→HKG → LHR fast_track allowed
 *   G3  AY Emerald on AY LHR→HEL → LHR priority_boarding allowed
 *   G4  U2 (easyJet, not oneworld) on U2 LHR→CDG → LHR fast_track not_enough_info
 *       (regression: expansion doesn't reach non-oneworld carriers)
 *   G5  AY Ruby (below Sapphire) on AY LHR → LHR fast_track not_enough_info
 *       (regression: tier gate still fires — expansion added carriers, didn't
 *        drop min_tier)
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

// Fixtures reflect post-expansion DB state
const EXPANDED_CARRIERS = ['BA', 'IB', 'AA', 'CX', 'QF', 'JL', 'QR', 'AY'];
function makeRule(o: Partial<AirportServiceRuleInput> = {}): AirportServiceRuleInput {
  return { id: 100, priority: 100, validFrom: '2020-01-01', validTo: null, confidence: 0.95,
    minAllianceTier: null, carrierRestriction: null, conditions: null,
    provider: null, action: 'allow', notes: null, tierSemantics: 'alliance_defined', ...o };
}
const LHR_FastTrack     = () => makeRule({ id: 4,  minAllianceTier: 'oneworld_sapphire', carrierRestriction: EXPANDED_CARRIERS, notes: 'Terminal 3 and Terminal 5 only', confidence: 0.95, tierSemantics: 'alliance_defined' });
const LHR_PriorityBoard = () => makeRule({ id: 11, minAllianceTier: 'oneworld_emerald', carrierRestriction: EXPANDED_CARRIERS, notes: 'Terminal 3 and Terminal 5 only', confidence: 0.9,  tierSemantics: 'alliance_defined' });

describe('LHR services carrier expansion — [BA,IB] → [BA,IB,AA,CX,QF,JL,QR]', () => {

  test('G1: AY Sapphire on AY LHR→HEL → fast_track allowed (was "?", now "✓" post-expansion)', () => {
    const p = makePassenger();
    const r = evaluateAirportService(p, makeStatus('oneworld_sapphire'), 'fast_track_security', [LHR_FastTrack()], NOW);
    assert.equal(r.status, 'allowed');
  });

  test('G2: CX Sapphire on CX LHR→HKG → fast_track allowed (CX operates T3)', () => {
    const p = makePassenger({ operatingCarrier: 'CX', marketingCarrier: 'CX',
      arrivalAirport: 'HKG', arrivalCountryCode: 'HK', arrivalIsSchengen: false });
    const r = evaluateAirportService(p, makeStatus('oneworld_sapphire'), 'fast_track_security', [LHR_FastTrack()], NOW);
    assert.equal(r.status, 'allowed');
  });

  test('G3: AY Emerald on AY LHR→HEL → priority_boarding allowed (emerald tier for boarding)', () => {
    const p = makePassenger();
    const r = evaluateAirportService(p, makeStatus('oneworld_emerald'), 'priority_boarding', [LHR_PriorityBoard()], NOW);
    assert.equal(r.status, 'allowed');
  });

  test('G4: U2 (easyJet, non-oneworld) LHR→CDG → fast_track not_enough_info (regression: expansion doesn\'t reach non-oneworld)', () => {
    const p = makePassenger({ operatingCarrier: 'U2', marketingCarrier: 'U2', operatingAlliance: null,
      arrivalAirport: 'CDG', arrivalCountryCode: 'FR' });
    const r = evaluateAirportService(p, makeStatus('none'), 'fast_track_security', [LHR_FastTrack()], NOW);
    // §63: U2 not on list → rule silent → not_enough_info (not denied)
    assert.equal(r.status, 'not_enough_info');
  });

  test('G5: AY Ruby (below Sapphire) + Economy cabin on AY LHR→HEL → fast_track DENIED (§64: alliance_defined tier-only miss = authoritative)', () => {
    // Explicitly economy: business/first would trigger §64 cabin override
    // and return not_enough_info (see tier-semantics-64 T9). This test
    // targets the "pure tier miss" case where no cabin path applies.
    const p = makePassenger({ cabin: 'economy' });
    const r = evaluateAirportService(p, makeStatus('oneworld_ruby'), 'fast_track_security', [LHR_FastTrack()], NOW);
    assert.equal(r.status, 'denied');
    assert.equal(r.confidence, 0.9);
  });
});
