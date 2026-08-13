CREATE TABLE `lead_emails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lead_id` int NOT NULL,
	`step` varchar(64) NOT NULL,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lead_emails_id` PRIMARY KEY(`id`),
	CONSTRAINT `lead_emails_lead_id_step_unique` UNIQUE(`lead_id`,`step`)
);
