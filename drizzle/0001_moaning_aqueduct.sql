CREATE TABLE `memory_images` (
	`id` text PRIMARY KEY NOT NULL,
	`memory_id` text,
	`object_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`ocr_model` text NOT NULL,
	`ocr_text` text NOT NULL,
	`corrected_text` text,
	`created_at` integer NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`memory_id`) REFERENCES `memories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memory_images_object_key_unique` ON `memory_images` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_memory_images_memory_id` ON `memory_images` (`memory_id`);--> statement-breakpoint
CREATE INDEX `idx_memory_images_created_at` ON `memory_images` (`created_at`);