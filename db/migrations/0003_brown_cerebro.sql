ALTER TABLE `airports` ADD `lounge_coverage_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `airports` ADD `coverage_verified_at` text;--> statement-breakpoint
ALTER TABLE `airports` ADD `coverage_source_url` text;