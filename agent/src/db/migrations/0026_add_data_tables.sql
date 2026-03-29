CREATE TABLE `data_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL REFERENCES `projects`(`id`) ON DELETE CASCADE,
	`name` text NOT NULL,
	`description` text,
	`columns` text NOT NULL DEFAULT '[]',
	`embedding` text,
	`row_count` integer NOT NULL DEFAULT 0,
	`created_by` text NOT NULL DEFAULT 'user',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `data_table_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL REFERENCES `data_tables`(`id`) ON DELETE CASCADE,
	`data` text NOT NULL DEFAULT '{}',
	`sort_order` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `data_table_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL REFERENCES `data_tables`(`id`) ON DELETE CASCADE,
	`row_id` text,
	`action` text NOT NULL,
	`actor` text NOT NULL DEFAULT 'user',
	`run_id` text REFERENCES `runs`(`id`) ON DELETE SET NULL,
	`diff` text NOT NULL DEFAULT '{}',
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_data_tables_project` ON `data_tables` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_data_table_rows_table` ON `data_table_rows` (`table_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_data_table_rows_sort` ON `data_table_rows` (`table_id`, `sort_order`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_data_table_changes_table` ON `data_table_changes` (`table_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_data_table_changes_run` ON `data_table_changes` (`run_id`);
