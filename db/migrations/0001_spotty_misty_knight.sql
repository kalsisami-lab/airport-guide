ALTER TABLE `airport_service_rules` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `airport_service_rules` ADD `action` text DEFAULT 'allow' NOT NULL;--> statement-breakpoint
ALTER TABLE `airport_service_rules` ADD `notes` text;