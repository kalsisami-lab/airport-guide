import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Shared column helpers ─────────────────────────────────────────────────────

const ruleColumns = {
  validFrom:   text('valid_from').notNull().default(sql`(date('now'))`),
  validTo:     text('valid_to'),
  priority:    integer('priority').notNull().default(100),
  sourceUrl:   text('source_url'),
  verifiedAt:  text('verified_at'),
  confidence:  real('confidence').notNull().default(0.9),
  conditions:  text('conditions', { mode: 'json' }).$type<Record<string, unknown>>(),
};

// ─── Reference tables ──────────────────────────────────────────────────────────

export const alliances = sqliteTable('alliances', {
  id:   integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),   // 'oneworld' | 'star_alliance' | 'skyteam'
  name: text('name').notNull(),
});

export const airlines = sqliteTable('airlines', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  iataCode:   text('iata_code').notNull().unique(),
  name:       text('name').notNull(),
  allianceId: integer('alliance_id').references(() => alliances.id), // nullable = independent
});

export const frequentFlyerPrograms = sqliteTable('frequent_flyer_programs', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  airlineId: integer('airline_id').notNull().references(() => airlines.id),
  name:      text('name').notNull(),   // 'Finnair Plus', 'Executive Club'
  code:      text('code').notNull().unique(), // 'ay-plus', 'ba-exec-club'
});

/**
 * alliance_tier uses a CHECK constraint as a SQLite-compatible enum.
 * This maps a programme-specific tier name ("Gold", "Platinum") to the
 * normalised alliance tier used by the entitlement engine.
 */
export const statusTiers = sqliteTable('status_tiers', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  programId:   integer('program_id').notNull().references(() => frequentFlyerPrograms.id),
  tierName:    text('tier_name').notNull(),   // 'Gold', 'Platinum', 'Lumo'
  allianceTier: text('alliance_tier', {
    enum: [
      'oneworld_emerald',
      'oneworld_sapphire',
      'oneworld_ruby',
      'star_gold',
      'star_silver',
      'skyteam_elite_plus',
      'skyteam_elite',
      'none',
    ],
  }).notNull().default('none'),
  fastTrack: integer('fast_track', { mode: 'boolean' }).notNull().default(false),
});

// ─── Geography ────────────────────────────────────────────────────────────────

export const airports = sqliteTable('airports', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  iataCode:    text('iata_code').notNull().unique(),
  name:        text('name').notNull(),
  city:        text('city').notNull(),
  countryCode: text('country_code').notNull(),  // ISO 3166-1 alpha-2
  // Lounge-coverage assertion for this airport (§67). Distinguishes
  // "we've verified there are no lounges here" from "we haven't seeded
  // any lounges here yet" — the empty-lounges list is otherwise identical
  // for both. Default 'unverified' preserves existing semantics until an
  // explicit verification is recorded (same source-required rigor as a
  // lounge row per §66).
  loungeCoverageStatus: text('lounge_coverage_status', {
    enum: ['verified_none', 'verified_seeded', 'unverified'],
  }).notNull().default('unverified'),
  coverageVerifiedAt:   text('coverage_verified_at'),
  coverageSourceUrl:    text('coverage_source_url'),
});

export const terminals = sqliteTable('terminals', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  airportId:    integer('airport_id').notNull().references(() => airports.id),
  name:         text('name').notNull(),   // 'Terminal 5', 'Main Terminal'
  schengenArea: integer('schengen_area', { mode: 'boolean' }).notNull().default(false),
}, (t) => [
  index('terminals_airport_idx').on(t.airportId),
]);

// ─── Lounges & access model ───────────────────────────────────────────────────

export const lounges = sqliteTable('lounges', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  airportId:           integer('airport_id').notNull().references(() => airports.id),
  terminalId:          integer('terminal_id').references(() => terminals.id),
  name:                text('name').notNull(),
  locationDescription: text('location_description'),
  tier:                text('tier', { enum: ['ultra_premium', 'premium', 'standard'] }).notNull(),
  loungeClass:         text('lounge_class', { enum: ['first', 'business', 'standard'] }).notNull(),
  area:                text('area', { enum: ['schengen', 'non_schengen', 'international', 'all'] }).notNull(),
  openingHours:        text('opening_hours'),
  amenities:           text('amenities', { mode: 'json' }).$type<string[]>(),
}, (t) => [
  index('lounges_airport_idx').on(t.airportId),
]);

/**
 * One lounge → many access channels (the many side of the many-to-many).
 * Each row represents ONE way to enter the lounge (alliance status, Priority Pass, etc.).
 * alliance_access only applies when channel_type = 'alliance_status'.
 */
export const loungeAccessChannels = sqliteTable('lounge_access_channels', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  loungeId:       integer('lounge_id').notNull().references(() => lounges.id),
  channelType:    text('channel_type', {
    enum: ['alliance_status', 'airline_own', 'priority_pass', 'lounge_key',
           'dragon_pass', 'amex_centurion', 'paid', 'invitation'],
  }).notNull(),
  /**
   * Only meaningful for alliance_status channels.
   * 'all_alliance'    – any carrier in the alliance + required tier.
   * 'carrier_specific' – carrier must be in the rule's carrier_restriction list.
   */
  allianceAccess: text('alliance_access', {
    enum: ['all_alliance', 'carrier_specific'],
  }),
}, (t) => [
  index('lac_lounge_idx').on(t.loungeId),
]);

/**
 * Concrete access rule for one channel.
 * A channel can have multiple rules (e.g. different valid_from ranges as policies change).
 * The engine evaluates all non-expired rules ordered by priority DESC.
 */
export const loungeAccessRules = sqliteTable('lounge_access_rules', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  channelId:         integer('channel_id').notNull().references(() => loungeAccessChannels.id),
  minAllianceTier:   text('min_alliance_tier', {
    enum: ['oneworld_emerald', 'oneworld_sapphire', 'oneworld_ruby',
           'star_gold', 'star_silver', 'skyteam_elite_plus', 'skyteam_elite', 'none'],
  }),
  carrierRestriction: text('carrier_restriction', { mode: 'json' }).$type<string[]>(),
  ...ruleColumns,
}, (t) => [
  index('lar_channel_idx').on(t.channelId),
]);

// ─── Airport-level service rules ──────────────────────────────────────────────

/**
 * Rules for services that apply at airport level: fast track, priority boarding, etc.
 * These are independent of lounge access — e.g. fast track does NOT require lounge access.
 */
export const airportServiceRules = sqliteTable('airport_service_rules', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  airportId:         integer('airport_id').notNull().references(() => airports.id),
  serviceType:       text('service_type', {
    enum: ['fast_track_security', 'priority_checkin', 'priority_boarding', 'priority_baggage'],
  }).notNull(),
  provider:          text('provider'),    // e.g. 'star_alliance_gold_track', 'paid', 'airline_own'
  action:            text('action', { enum: ['allow', 'deny'] }).notNull().default('allow'),
  notes:             text('notes'),       // human-readable caveat shown in UI tooltip
  minAllianceTier:   text('min_alliance_tier', {
    enum: ['oneworld_emerald', 'oneworld_sapphire', 'oneworld_ruby',
           'star_gold', 'star_silver', 'skyteam_elite_plus', 'skyteam_elite', 'none'],
  }),
  carrierRestriction: text('carrier_restriction', { mode: 'json' }).$type<string[]>(),
  // Tier-hierarchy semantics for this rule (§64). 'alliance_defined' means the tier
  // requirement is authoritative — if a passenger doesn't meet it (and everything else
  // does match), engine returns `denied`. 'local' means tier is one of several possible
  // paths and a miss is inconclusive — engine returns `not_enough_info`.
  // Default 'local' preserves existing behavior for rules that don't opt in.
  tierSemantics:      text('tier_semantics', {
    enum: ['alliance_defined', 'local'],
  }).notNull().default('local'),
  ...ruleColumns,
}, (t) => [
  index('asr_airport_idx').on(t.airportId),
]);

// ─── Exception overrides ──────────────────────────────────────────────────────

/**
 * Overrides any rule for edge cases: seasonal blackouts, special events,
 * temporary expansions, policy changes mid-year, etc.
 * The engine applies exceptions AFTER evaluating all base rules.
 */
export const exceptionRules = sqliteTable('exception_rules', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  appliesTo:     text('applies_to', {
    enum: ['lounge', 'service', 'airline'],
  }).notNull(),
  targetId:      integer('target_id').notNull(),  // FK to lounge_id / airport_service_rule_id etc.
  exceptionType: text('exception_type', {
    enum: ['override', 'blackout', 'additional_requirement'],
  }).notNull(),
  description:   text('description'),
  ...ruleColumns,
});

// ─── Relation type exports (for Drizzle relational queries) ───────────────────

export type Alliance       = typeof alliances.$inferSelect;
export type Airline        = typeof airlines.$inferSelect;
export type FFP            = typeof frequentFlyerPrograms.$inferSelect;
export type StatusTier     = typeof statusTiers.$inferSelect;
export type Airport        = typeof airports.$inferSelect;
export type Terminal       = typeof terminals.$inferSelect;
export type Lounge         = typeof lounges.$inferSelect;
export type AccessChannel  = typeof loungeAccessChannels.$inferSelect;
export type AccessRule     = typeof loungeAccessRules.$inferSelect;
export type ServiceRule    = typeof airportServiceRules.$inferSelect;
export type ExceptionRule  = typeof exceptionRules.$inferSelect;
