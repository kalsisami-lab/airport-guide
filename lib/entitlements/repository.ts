import { db } from '../../db/client';
import {
  airports, lounges,
  loungeAccessChannels, loungeAccessRules,
  exceptionRules, airportServiceRules,
} from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { AllianceTier } from '../normalization/types';
import type { Condition, LoungeInput } from '../engine/types';
import type { AirportRepository, FastTrackRuleInput, PriorityBoardingRuleInput, LoungeInputWithMeta } from './types';

function toDate(s: string | null | undefined): string | null {
  return s ?? null;
}

export function createAirportRepository(): AirportRepository {
  return {
    getLoungesAtAirport(iataCode: string): LoungeInput[] {
      const airport = db.select().from(airports)
        .where(eq(airports.iataCode, iataCode))
        .get();
      if (!airport) return [];

      const loungeRows = db.select().from(lounges)
        .where(eq(lounges.airportId, airport.id))
        .all();
      if (!loungeRows.length) return [];

      const loungeIds = loungeRows.map((l) => l.id);

      const channelRows = db.select().from(loungeAccessChannels)
        .where(inArray(loungeAccessChannels.loungeId, loungeIds))
        .all();

      const channelIds = channelRows.map((c) => c.id);

      const ruleRows = channelIds.length
        ? db.select().from(loungeAccessRules)
            .where(inArray(loungeAccessRules.channelId, channelIds))
            .all()
        : [];

      const exceptRows = loungeIds.length
        ? db.select().from(exceptionRules)
            .where(and(
              eq(exceptionRules.appliesTo, 'lounge'),
              inArray(exceptionRules.targetId, loungeIds),
            ))
            .all()
        : [];

      return loungeRows.map((l): LoungeInputWithMeta => ({
        id:                  l.id,
        name:                l.name,
        terminalId:          l.terminalId,
        openingHours:        l.openingHours ?? null,
        tier:                l.tier,
        loungeClass:         l.loungeClass,
        locationDescription: l.locationDescription ?? null,
        amenities:           l.amenities ?? null,
        channels: channelRows
          .filter((c) => c.loungeId === l.id)
          .map((ch) => ({
            id:            ch.id,
            channelType:   ch.channelType,
            allianceAccess: ch.allianceAccess ?? null,
            rules: ruleRows
              .filter((r) => r.channelId === ch.id)
              .map((r) => ({
                id:                 r.id,
                priority:           r.priority,
                validFrom:          r.validFrom,
                validTo:            toDate(r.validTo),
                confidence:         r.confidence,
                minAllianceTier:    (r.minAllianceTier ?? null) as AllianceTier | null,
                carrierRestriction: r.carrierRestriction ?? null,
                conditions:         (r.conditions as Condition) ?? null,
              })),
          })),
        exceptions: exceptRows
          .filter((e) => e.targetId === l.id)
          .map((e) => ({
            id:            e.id,
            exceptionType: e.exceptionType,
            priority:      e.priority,
            validFrom:     e.validFrom,
            validTo:       toDate(e.validTo),
            confidence:    e.confidence,
            conditions:    (e.conditions as Condition) ?? null,
            description:   e.description ?? null,
          })),
      }));
    },

    getFastTrackRules(iataCode: string): FastTrackRuleInput[] {
      return getServiceRules(iataCode, 'fast_track');
    },

    getPriorityBoardingRules(iataCode: string): PriorityBoardingRuleInput[] {
      return getServiceRules(iataCode, 'priority_boarding');
    },
  };
}

function getServiceRules(
  iataCode: string,
  serviceType: 'fast_track' | 'priority_boarding',
): FastTrackRuleInput[] {
  const airport = db.select().from(airports)
    .where(eq(airports.iataCode, iataCode))
    .get();
  if (!airport) return [];

  return db.select().from(airportServiceRules)
    .where(and(
      eq(airportServiceRules.airportId, airport.id),
      eq(airportServiceRules.serviceType, serviceType),
    ))
    .all()
    .map((r) => ({
      id:                 r.id,
      priority:           r.priority,
      validFrom:          r.validFrom,
      validTo:            r.validTo ?? null,
      confidence:         r.confidence,
      minAllianceTier:    (r.minAllianceTier ?? null) as AllianceTier | null,
      carrierRestriction: r.carrierRestriction ?? null,
      conditions:         (r.conditions as Condition) ?? null,
    }));
}
