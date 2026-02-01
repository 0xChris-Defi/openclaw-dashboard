CREATE TABLE `channel_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channelType` enum('telegram','discord','slack','whatsapp','feishu','lark','imessage','wechat','custom') NOT NULL,
	`name` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`config` json,
	`lastTestedAt` timestamp,
	`testStatus` enum('pending','success','failed'),
	`testMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channel_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('openai','anthropic','openrouter','google','minimax','deepseek','moonshot','zhipu','baichuan','qwen','custom') NOT NULL,
	`name` varchar(100) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`isDefault` boolean NOT NULL DEFAULT false,
	`config` json,
	`models` json,
	`selectedModel` varchar(255),
	`lastTestedAt` timestamp,
	`testStatus` enum('pending','success','failed'),
	`testMessage` text,
	`testLatency` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`)
);
