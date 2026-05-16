CREATE TABLE `airlines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`iata_code` text NOT NULL,
	`name` text NOT NULL,
	`alliance_id` integer,
	FOREIGN KEY (`alliance_id`) REFERENCES `alliances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `airlines_iata_code_unique` ON `airlines` (`iata_code`);--> statement-breakpoint
CREATE TABLE `airport_service_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`airport_id` integer NOT NULL,
	`service_type` text NOT NULL,
	`min_alliance_tier` text,
	`carrier_restriction` text,
	`valid_from` text DEFAULT (date('now')) NOT NULL,
	`valid_to` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`source_url` text,
	`verified_at` text,
	`confidence` real DEFAULT 0.9 NOT NULL,
	`conditions` text,
	FOREIGN KEY (`airport_id`) REFERENCES `airports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asr_airport_idx` ON `airport_service_rules` (`airport_id`);--> statement-breakpoint
CREATE TABLE `airports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`iata_code` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`country_code` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `airports_iata_code_unique` ON `airports` (`iata_code`);--> statement-breakpoint
CREATE TABLE `alliances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alliances_code_unique` ON `alliances` (`code`);--> statement-breakpoint
CREATE TABLE `exception_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`applies_to` text NOT NULL,
	`target_id` integer NOT NULL,
	`exception_type` text NOT NULL,
	`description` text,
	`valid_from` text DEFAULT (date('now')) NOT NULL,
	`valid_to` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`source_url` text,
	`verified_at` text,
	`confidence` real DEFAULT 0.9 NOT NULL,
	`conditions` text
);
--> statement-breakpoint
CREATE TABLE `frequent_flyer_programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`airline_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	FOREIGN KEY (`airline_id`) REFERENCES `airlines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `frequent_flyer_programs_code_unique` ON `frequent_flyer_programs` (`code`);--> statement-breakpoint
CREATE TABLE `lounge_access_channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lounge_id` integer NOT NULL,
	`channel_type` text NOT NULL,
	`alliance_access` text,
	FOREIGN KEY (`lounge_id`) REFERENCES `lounges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lac_lounge_idx` ON `lounge_access_channels` (`lounge_id`);--> statement-breakpoint
CREATE TABLE `lounge_access_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`min_alliance_tier` text,
	`carrier_restriction` text,
	`valid_from` text DEFAULT (date('now')) NOT NULL,
	`valid_to` text,
	`priority` integer DEFAULT 100 NOT NULL,
	`source_url` text,
	`verified_at` text,
	`confidence` real DEFAULT 0.9 NOT NULL,
	`conditions` text,
	FOREIGN KEY (`channel_id`) REFERENCES `lounge_access_channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lar_channel_idx` ON `lounge_access_rules` (`channel_id`);--> statement-breakpoint
CREATE TABLE `lounges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`airport_id` integer NOT NULL,
	`terminal_id` integer,
	`name` text NOT NULL,
	`location_description` text,
	`tier` text NOT NULL,
	`lounge_class` text NOT NULL,
	`area` text NOT NULL,
	`opening_hours` text,
	`amenities` text,
	FOREIGN KEY (`airport_id`) REFERENCES `airports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terminal_id`) REFERENCES `terminals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lounges_airport_idx` ON `lounges` (`airport_id`);--> statement-breakpoint
CREATE TABLE `status_tiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`program_id` integer NOT NULL,
	`tier_name` text NOT NULL,
	`alliance_tier` text DEFAULT 'none' NOT NULL,
	`fast_track` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `frequent_flyer_programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `terminals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`airport_id` integer NOT NULL,
	`name` text NOT NULL,
	`schengen_area` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`airport_id`) REFERENCES `airports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `terminals_airport_idx` ON `terminals` (`airport_id`);