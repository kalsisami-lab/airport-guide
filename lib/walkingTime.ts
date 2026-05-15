import type { GateInfo } from '@/data/gates';
import { pierPosition } from '@/data/gates';
import type { Lounge } from '@/data/lounges';

export type WalkResult =
  | { reachable: true; minutes: number }
  | { reachable: false; reason: string };

// Base walking minutes from pier to lounge (null = blocked by security boundary)
type PierToLounge = Partial<Record<string, number | null>>;

const BASE_MINUTES: Record<string, Record<string, PierToLounge>> = {
  HKG: {
    T1W: {
      'hkg-cx-wing-first':    3,
      'hkg-cx-wing-business': 3,
      'hkg-cx-pier-first':    18,
      'hkg-cx-pier-business': 18,
      'hkg-plaza-premium':    8,
    },
    T1M: {
      'hkg-cx-wing-first':    12,
      'hkg-cx-wing-business': 12,
      'hkg-cx-pier-first':    10,
      'hkg-cx-pier-business': 10,
      'hkg-plaza-premium':    5,
    },
    T1E: {
      'hkg-cx-wing-first':    20,
      'hkg-cx-wing-business': 20,
      'hkg-cx-pier-first':    4,
      'hkg-cx-pier-business': 4,
      'hkg-plaza-premium':    8,
    },
  },
  HEL: {
    B: {
      'finnair-lounge-schengen':     4,
      'helsinki-airport-lounge':     9,
      'op-lounge-aspire':            8,
      'pier-zero':                   5,
      'finnair-lounge-non-schengen': null,
      'finnair-platinum-wing':       null,
    },
    C: {
      'finnair-lounge-schengen':     9,
      'helsinki-airport-lounge':     4,
      'op-lounge-aspire':            3,
      'pier-zero':                   2,
      'finnair-lounge-non-schengen': null,
      'finnair-platinum-wing':       null,
    },
    D: {
      'finnair-lounge-non-schengen': 5,
      'finnair-platinum-wing':       6,
      'pier-zero':                   null,
      'finnair-lounge-schengen':     null,
      'helsinki-airport-lounge':     null,
      'op-lounge-aspire':            null,
    },
    E: {
      'finnair-lounge-non-schengen': 9,
      'finnair-platinum-wing':       14,
      'pier-zero':                   null,
      'finnair-lounge-schengen':     null,
      'helsinki-airport-lounge':     null,
      'op-lounge-aspire':            null,
    },
  },
  LHR: {
    T2: {
      'lhr-no1-lounge-t2':    4,
      'lhr-ba-concorde-room': null,
      'lhr-ba-first-lounge':  null,
      'lhr-ba-galleries-club':null,
      'lhr-aspire-t5':        null,
    },
    T3: {
      'lhr-no1-lounge-t2':    12,
      'lhr-ba-concorde-room': null,
      'lhr-ba-first-lounge':  null,
      'lhr-ba-galleries-club':null,
      'lhr-aspire-t5':        null,
    },
    T4: {
      'lhr-no1-lounge-t2':    null,
      'lhr-ba-concorde-room': null,
      'lhr-ba-first-lounge':  null,
      'lhr-ba-galleries-club':null,
      'lhr-aspire-t5':        null,
    },
    T5: {
      'lhr-ba-concorde-room':  5,
      'lhr-ba-first-lounge':   6,
      'lhr-ba-galleries-club': 5,
      'lhr-aspire-t5':         7,
      'lhr-no1-lounge-t2':     null,
    },
  },
  AMS: {
    'D/F': {
      'ams-klm-crown-schengen':     5,
      'ams-aspire-lounge':          7,
      'ams-klm-crown-non-schengen': null,
    },
    E: {
      'ams-klm-crown-non-schengen': 6,
      'ams-klm-crown-schengen':     null,
      'ams-aspire-lounge':          null,
    },
  },
  FRA: {
    A: {
      'fra-lh-business-schengen':     5,
      'fra-gate-gourmet-lounge':      8,
      'fra-lh-senator':               null,
      'fra-lh-business-non-schengen': null,
      'fra-aspire-lounge':            null,
    },
    B: {
      'fra-lh-senator':               5,
      'fra-lh-business-non-schengen': 5,
      'fra-aspire-lounge':            6,
      'fra-lh-business-schengen':     null,
      'fra-gate-gourmet-lounge':      null,
    },
    C: {
      'fra-lh-senator':               10,
      'fra-lh-business-non-schengen': 10,
      'fra-aspire-lounge':            8,
      'fra-lh-business-schengen':     null,
      'fra-gate-gourmet-lounge':      null,
    },
    Z: {
      'fra-gate-gourmet-lounge':      4,
      'fra-lh-senator':               null,
      'fra-lh-business-non-schengen': null,
      'fra-aspire-lounge':            null,
      'fra-lh-business-schengen':     null,
    },
  },
  CDG: {
    // Schengen gates (Hall 2F / 2G / 2K) → Schengen lounges accessible; Non-Schengen blocked
    '2F': {
      'cdg-af-salon-schengen':          4,
      'cdg-aspire-lounge-schengen':     6,
      'cdg-af-salon-non-schengen':      null,
      'cdg-extime-lounge-non-schengen': null,
    },
    '2G': {
      'cdg-af-salon-schengen':          7,
      'cdg-aspire-lounge-schengen':     9,
      'cdg-af-salon-non-schengen':      null,
      'cdg-extime-lounge-non-schengen': null,
    },
    '2K': {
      'cdg-af-salon-schengen':          5,
      'cdg-aspire-lounge-schengen':     8,
      'cdg-af-salon-non-schengen':      null,
      'cdg-extime-lounge-non-schengen': null,
    },
    // Non-Schengen gates (Hall 2E / 2D) → Non-Schengen lounges accessible; Schengen blocked
    '2E': {
      'cdg-af-salon-non-schengen':      5,
      'cdg-extime-lounge-non-schengen': 8,
      'cdg-af-salon-schengen':          null,
      'cdg-aspire-lounge-schengen':     null,
    },
    '2D': {
      'cdg-af-salon-non-schengen':      7,
      'cdg-extime-lounge-non-schengen': 6,
      'cdg-af-salon-schengen':          null,
      'cdg-aspire-lounge-schengen':     null,
    },
  },
  ARN: {
    T2: {
      'arn-sas-business-schengen': 5,
      'arn-sas-gold-lounge':       null,
      'arn-no1-lounge':            null,
    },
    E: {
      'arn-sas-business-schengen': 6,
      'arn-sas-gold-lounge':       null,
      'arn-no1-lounge':            null,
    },
    F: {
      'arn-sas-gold-lounge':       5,
      'arn-no1-lounge':            8,
      'arn-sas-business-schengen': null,
    },
  },
};

const PIER_DEPTH_PENALTY = 3;

export function estimateWalkingTime(gate: GateInfo, lounge: Lounge, airportIata: string): WalkResult {
  const base = BASE_MINUTES[airportIata]?.[gate.pier]?.[lounge.id];

  if (base === null || base === undefined) {
    return {
      reachable: false,
      reason:
        gate.area === 'schengen'
          ? 'Lounge is past passport control'
          : 'Lounge is in the Schengen area',
    };
  }

  const depth = Math.round(pierPosition(gate, airportIata) * PIER_DEPTH_PENALTY);
  return { reachable: true, minutes: base + depth };
}
