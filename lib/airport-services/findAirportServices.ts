import type { PassengerContext, StatusContext } from '../normalization/types';
import type { AccessResult } from '../engine/types';
import type { AirportServiceRuleInput, AirportServicesResult, ServiceType } from './types';
import { ALL_SERVICE_TYPES } from './types';
import { evaluateAirportService } from './evaluateAirportService';

export function findAirportServices(
  passenger: PassengerContext,
  status: StatusContext | null,
  airportIata: string,
  rulesMap: Record<ServiceType, AirportServiceRuleInput[]>,
  now: Date,
  fastTrackCards: Set<string> = new Set(),
): AirportServicesResult {
  const services = {} as Record<ServiceType, AccessResult>;

  for (const serviceType of ALL_SERVICE_TYPES) {
    services[serviceType] = evaluateAirportService(
      passenger,
      status,
      serviceType,
      rulesMap[serviceType] ?? [],
      now,
      fastTrackCards,
    );
  }

  return { airportIata, services };
}
