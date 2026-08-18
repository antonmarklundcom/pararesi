CREATE TABLE `cron_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job` varchar(64) NOT NULL,
	`eligible` int NOT NULL DEFAULT 0,
	`sent` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`ran_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cron_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cron_runs_job_ran_at_idx` ON `cron_runs` (`job`,`ran_at`);