import { db } from '../../db/client';
import { airlines, alliances, frequentFlyerPrograms, statusTiers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type { AllianceCode, AllianceTier, AirlineRepository, TierRepository } from './types';

// Loads once at import time — these tables are effectively static at runtime.

export function createAirlineRepository(): AirlineRepository {
  const rows = db
    .select({ iataCode: airlines.iataCode, allianceCode: alliances.code })
    .from(airlines)
    .leftJoin(alliances, eq(airlines.allianceId, alliances.id))
    .all();

  const map = new Map<string, AllianceCode>(
    rows.map((r) => [r.iataCode, (r.allianceCode ?? null) as AllianceCode]),
  );

  return { getAllianceForCarrier: (code) => map.get(code) ?? null };
}

export function createTierRepository(): TierRepository {
  const rows = db
    .select({
      programCode:  frequentFlyerPrograms.code,
      tierName:     statusTiers.tierName,
      allianceTier: statusTiers.allianceTier,
      fastTrack:    statusTiers.fastTrack,
    })
    .from(statusTiers)
    .innerJoin(frequentFlyerPrograms, eq(statusTiers.programId, frequentFlyerPrograms.id))
    .all();

  const map = new Map(
    rows.map((r) => [
      `${r.programCode}:${r.tierName}`,
      { allianceTier: r.allianceTier as AllianceTier, fastTrack: r.fastTrack },
    ]),
  );

  return { getTierForCard: (prog, tier) => map.get(`${prog}:${tier}`) ?? null };
}
