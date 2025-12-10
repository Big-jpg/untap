CREATE TABLE `check_results` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	`checkType` enum('http','tcp','icmp') NOT NULL,
	`success` boolean NOT NULL,
	`httpStatus` int,
	`latencyMs` int,
	`errorCode` varchar(64),
	`errorMessage` text,
	`meta` json,
	CONSTRAINT `check_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`status` enum('open','resolved') NOT NULL DEFAULT 'open',
	`failureRate` int,
	`summary` text,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`notifiedAt` timestamp,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`displayName` varchar(256) NOT NULL,
	`category` varchar(64),
	`homepageUrl` text,
	`checkType` enum('http','tcp','icmp') NOT NULL,
	`checkTarget` text NOT NULL,
	`expectedStatus` int DEFAULT 200,
	`expectedBody` text,
	`timeoutMs` int DEFAULT 5000,
	`checkIntervalS` int DEFAULT 60,
	`isActive` boolean DEFAULT true,
	`isCritical` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
