import type { LoungeAccessMethod } from './lounges';

export type CardLoungeAccess = Extract<
  LoungeAccessMethod,
  'priority-pass' | 'lounge-key' | 'dragon-pass' | 'amex-platinum' | 'op-card'
>;

export type CreditCard = {
  id: string;
  name: string;
  issuer: string;
  country: string;
  loungeAccess: CardLoungeAccess[];
  fastTrack: boolean;
  guestPolicy?: string;
  notes?: string;
};

export const creditCards: CreditCard[] = [
  {
    id: 'amex-platinum',
    name: 'American Express Platinum',
    issuer: 'American Express',
    country: 'Global',
    loungeAccess: ['priority-pass', 'amex-platinum'],
    fastTrack: true,
    guestPolicy: 'Up to 2 complimentary guests via Priority Pass Prestige',
  },
  {
    id: 'amex-gold',
    name: 'American Express Gold',
    issuer: 'American Express',
    country: 'Global',
    loungeAccess: ['priority-pass'],
    fastTrack: false,
    guestPolicy: 'Up to 10 complimentary Priority Pass visits/year',
  },
  {
    id: 'op-visa-platinum',
    name: 'OP Visa Platinum',
    issuer: 'OP Financial Group',
    country: 'Finland',
    loungeAccess: ['priority-pass', 'op-card'],
    fastTrack: false,
    guestPolicy: 'Priority Pass membership included',
  },
  {
    id: 'op-mastercard-world',
    name: 'OP Mastercard World Elite',
    issuer: 'OP Financial Group',
    country: 'Finland',
    loungeAccess: ['lounge-key', 'op-card'],
    fastTrack: false,
    guestPolicy: 'LoungeKey membership included',
  },
  {
    id: 'nordea-platinum',
    name: 'Nordea Platinum Mastercard',
    issuer: 'Nordea',
    country: 'Finland',
    loungeAccess: ['lounge-key'],
    fastTrack: false,
  },
  {
    id: 'seb-platinum',
    name: 'SEB Platinum Mastercard',
    issuer: 'SEB',
    country: 'Finland',
    loungeAccess: ['priority-pass'],
    fastTrack: false,
  },
  {
    id: 'danske-platinum',
    name: 'Danske Bank Platinum',
    issuer: 'Danske Bank',
    country: 'Finland',
    loungeAccess: ['lounge-key'],
    fastTrack: false,
  },
  {
    id: 'finnair-visa',
    name: 'Finnair Visa (OP)',
    issuer: 'OP Financial Group',
    country: 'Finland',
    loungeAccess: [],
    fastTrack: false,
    notes: 'Earns Finnair Plus points but no direct lounge access',
  },
  {
    id: 'chase-sapphire-reserve',
    name: 'Chase Sapphire Reserve',
    issuer: 'Chase',
    country: 'USA',
    loungeAccess: ['priority-pass'],
    fastTrack: false,
    guestPolicy: 'Unlimited guests via Priority Pass Select',
  },
  {
    id: 'diners-club',
    name: 'Diners Club Carte Blanche',
    issuer: 'Diners Club',
    country: 'Global',
    loungeAccess: ['priority-pass', 'lounge-key'],
    fastTrack: false,
    guestPolicy: 'Priority Pass + LoungeKey included',
  },
];
