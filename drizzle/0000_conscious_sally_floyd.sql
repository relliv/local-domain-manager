CREATE TABLE `analytics_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`event` text NOT NULL,
	`data` text NOT NULL,
	`timestamp` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dns_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`ttl` integer DEFAULT 3600,
	`priority` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ip_address` text NOT NULL,
	`port` integer DEFAULT 80,
	`is_active` integer DEFAULT true,
	`description` text,
	`category` text,
	`tags` text,
	`parent_id` integer,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`parent_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `monitoring_data` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`status` text NOT NULL,
	`response_time` real,
	`status_code` integer,
	`error_message` text,
	`checked_at` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ssl_certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`domain_id` integer NOT NULL,
	`issuer` text,
	`valid_from` integer,
	`valid_to` integer,
	`fingerprint` text,
	`is_valid` integer DEFAULT true,
	`last_checked` integer DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_domain_event` ON `analytics_data` (`domain_id`,`event`);--> statement-breakpoint
CREATE INDEX `idx_analytics_timestamp` ON `analytics_data` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_dns_domain` ON `dns_records` (`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_dns_type` ON `dns_records` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_domain_name` ON `domains` (`name`);--> statement-breakpoint
CREATE INDEX `idx_domain_category` ON `domains` (`category`);--> statement-breakpoint
CREATE INDEX `idx_domain_parent` ON `domains` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_domain` ON `monitoring_data` (`domain_id`);--> statement-breakpoint
CREATE INDEX `idx_monitoring_checked_at` ON `monitoring_data` (`checked_at`);--> statement-breakpoint
CREATE INDEX `idx_ssl_domain` ON `ssl_certificates` (`domain_id`);