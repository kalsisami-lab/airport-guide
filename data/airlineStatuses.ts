import type { LoungeAccessMethod } from './lounges';

export type Alliance = 'oneworld' | 'star-alliance' | 'skyteam' | 'none';
export type LoungeTierAccess = 'none' | 'gold' | 'platinum';

export type AirlineStatus = {
  id: string;
  name: string;
  airline: string;
  alliance: Alliance;
  fastTrack: boolean;
  loungeTier: LoungeTierAccess;
  accessMethods: LoungeAccessMethod[];
};

export const airlineStatuses: AirlineStatus[] = [
  // Finnair Plus
  {
    id: 'finnair-basic',
    name: 'Finnair Plus Basic',
    airline: 'Finnair',
    alliance: 'oneworld',
    fastTrack: false,
    loungeTier: 'none',
    accessMethods: [],
  },
  {
    id: 'finnair-silver',
    name: 'Finnair Plus Silver',
    airline: 'Finnair',
    alliance: 'oneworld',
    fastTrack: false,
    loungeTier: 'none',
    accessMethods: [],
  },
  {
    id: 'finnair-gold',
    name: 'Finnair Plus Gold',
    airline: 'Finnair',
    alliance: 'oneworld',
    fastTrack: true,
    loungeTier: 'gold',
    // Finnair Plus Gold = oneworld Sapphire — must match partner airport lounge accessMethods
    accessMethods: ['finnair-plus-gold', 'oneworld-sapphire'],
  },
  {
    id: 'finnair-platinum',
    name: 'Finnair Plus Platinum',
    airline: 'Finnair',
    alliance: 'oneworld',
    fastTrack: true,
    loungeTier: 'platinum',
    // Finnair Plus Platinum = oneworld Emerald — unlocks First Class lounges at all oneworld partner airports
    accessMethods: ['finnair-plus-gold', 'finnair-plus-platinum', 'oneworld-sapphire', 'oneworld-emerald'],
  },

  // Oneworld tiers (when flying Finnair or Oneworld partner)
  {
    id: 'oneworld-ruby',
    name: 'Oneworld Ruby',
    airline: 'Various Oneworld',
    alliance: 'oneworld',
    fastTrack: false,
    loungeTier: 'none',
    accessMethods: [],
  },
  {
    id: 'oneworld-sapphire',
    name: 'Oneworld Sapphire',
    airline: 'Various Oneworld',
    alliance: 'oneworld',
    fastTrack: true,
    loungeTier: 'gold',
    accessMethods: ['oneworld-sapphire'],
  },
  {
    id: 'oneworld-emerald',
    name: 'Oneworld Emerald',
    airline: 'Various Oneworld',
    alliance: 'oneworld',
    fastTrack: true,
    loungeTier: 'platinum',
    accessMethods: ['oneworld-sapphire', 'oneworld-emerald'],
  },

  // Star Alliance (limited lounge access at HEL – primarily a Finnair/OW hub)
  {
    id: 'star-silver',
    name: 'Star Alliance Silver',
    airline: 'Various Star Alliance',
    alliance: 'star-alliance',
    fastTrack: false,
    loungeTier: 'none',
    accessMethods: [],
  },
  {
    id: 'star-gold',
    name: 'Star Alliance Gold',
    airline: 'Various Star Alliance',
    alliance: 'star-alliance',
    fastTrack: true,
    loungeTier: 'gold',
    accessMethods: ['star-alliance-gold'],
  },

  // SkyTeam
  {
    id: 'skyteam-elite',
    name: 'SkyTeam Elite',
    airline: 'Various SkyTeam',
    alliance: 'skyteam',
    fastTrack: false,
    loungeTier: 'none',
    accessMethods: [],
  },
  {
    id: 'skyteam-elite-plus',
    name: 'SkyTeam Elite Plus',
    airline: 'Various SkyTeam',
    alliance: 'skyteam',
    fastTrack: true,
    loungeTier: 'gold',
    accessMethods: ['skyteam-elite-plus'],
  },
];
