CREATE TABLE `telegram_allowlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`telegramUsername` varchar(64),
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	`addedBy` int NOT NULL,
	`notes` text,
	CONSTRAINT `telegram_allowlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_allowlist_telegramUserId_unique` UNIQUE(`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_paired_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUserId` varchar(64) NOT NULL,
	`telegramUsername` varchar(64),
	`telegramName` varchar(128),
	`pairedAt` timestamp NOT NULL DEFAULT (now()),
	`pairedBy` int,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`notes` text,
	CONSTRAINT `telegram_paired_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_paired_users_telegramUserId_unique` UNIQUE(`telegramUserId`)
);
--> statement-breakpoint
CREATE TABLE `telegram_pairing_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`usedByTelegramId` varchar(64),
	`createdBy` int NOT NULL,
	`status` enum('pending','used','expired','revoked') NOT NULL DEFAULT 'pending',
	CONSTRAINT `telegram_pairing_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_pairing_codes_code_unique` UNIQUE(`code`)
);
