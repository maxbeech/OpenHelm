-- Add sort_order column to goals and jobs for custom ordering
ALTER TABLE `goals` ADD `sort_order` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `jobs` ADD `sort_order` integer NOT NULL DEFAULT 0;
