CREATE TABLE `gateway_monitors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`timestamp` bigint NOT NULL,
	`status` enum('running','stopped','error') NOT NULL,
	`pid` int,
	`cpu_usage` decimal(5,2),
	`memory_usage` decimal(10,2),
	`uptime` bigint,
	`request_count` int DEFAULT 0,
	`error_count` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gateway_monitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gateway_restart_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger_type` enum('manual','webhook_check','health_check','scheduled') NOT NULL,
	`trigger_user_id` varchar(255),
	`reason` text,
	`old_pid` int,
	`new_pid` int,
	`success` boolean NOT NULL,
	`error_message` text,
	`duration_ms` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gateway_restart_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gateway_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gateway_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `gateway_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `webhook_status_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`check_timestamp` bigint NOT NULL,
	`webhook_url` varchar(500),
	`is_active` boolean NOT NULL,
	`pending_update_count` int DEFAULT 0,
	`last_error_date` bigint,
	`last_error_message` text,
	`response_time_ms` int,
	`action_taken` enum('none','restart','alert') DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_status_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_timestamp` ON `gateway_monitors` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_created_at` ON `gateway_restart_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_check_timestamp` ON `webhook_status_logs` (`check_timestamp`);