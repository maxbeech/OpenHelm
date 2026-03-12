ALTER TABLE `jobs` ADD `correction_context` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `parent_run_id` text REFERENCES `runs`(`id`) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `correction_context` text;
