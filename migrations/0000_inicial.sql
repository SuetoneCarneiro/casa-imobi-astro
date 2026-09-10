CREATE TABLE `properties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`price` integer NOT NULL,
	`purpose` text DEFAULT 'sale' NOT NULL,
	`type` text NOT NULL,
	`category` text DEFAULT 'residential' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`is_condo` integer DEFAULT false NOT NULL,
	`bedrooms` integer DEFAULT 0 NOT NULL,
	`suites` integer DEFAULT 0 NOT NULL,
	`bathrooms` integer DEFAULT 0 NOT NULL,
	`parking_spaces` integer DEFAULT 0 NOT NULL,
	`usable_area` real,
	`address_street` text,
	`address_number` text,
	`hide_address_number` integer DEFAULT false NOT NULL,
	`address_neighborhood` text,
	`address_city` text DEFAULT 'Caruaru' NOT NULL,
	`address_state` text DEFAULT 'PE' NOT NULL,
	`address_zip` text,
	`development` text,
	`video_url` text,
	`created_by` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_properties_code` ON `properties` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_properties_slug` ON `properties` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_properties_listing` ON `properties` (`status`,`type`,`price`);--> statement-breakpoint
CREATE INDEX `idx_properties_neighborhood` ON `properties` (`address_neighborhood`);--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`property_id` integer NOT NULL,
	`storage_key` text NOT NULL,
	`alt` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_cover` integer DEFAULT false NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_images_property` ON `property_images` (`property_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_images_cover` ON `property_images` (`property_id`) WHERE is_cover = 1;--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);