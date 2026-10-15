CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source` text DEFAULT '내 기록' NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_id` text,
	`search_text` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memories_created_at` ON `memories` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_memories_source_type_created_at` ON `memories` (`source_type`,`created_at`);