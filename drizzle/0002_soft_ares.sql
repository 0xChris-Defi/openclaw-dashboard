CREATE TABLE `custom_models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`modelId` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_models_id` PRIMARY KEY(`id`)
);
