CREATE TABLE `blog_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`excerpt` text,
	`content_md` longtext NOT NULL,
	`meta_title` varchar(255),
	`meta_description` varchar(500),
	`published_at` datetime,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	CONSTRAINT `blog_posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `blog_posts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`user_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_progress_user_id_lesson_id_pk` PRIMARY KEY(`user_id`,`lesson_id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`module_id` int NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`content_md` longtext NOT NULL,
	`video_url` varchar(512),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `lessons_module_id_slug_unique` UNIQUE(`module_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`sort_order` int NOT NULL DEFAULT 0,
	`min_tier` enum('guide','insider') NOT NULL DEFAULT 'guide',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	CONSTRAINT `modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `modules_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `password_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`purpose` enum('set','reset') NOT NULL,
	`expires_at` datetime NOT NULL,
	`used_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ls_order_id` varchar(64) NOT NULL,
	`ls_product_id` varchar(64) NOT NULL,
	`ls_variant_id` varchar(64) NOT NULL,
	`product_key` varchar(64) NOT NULL,
	`amount_usd` int NOT NULL,
	`status` varchar(32) NOT NULL,
	`raw` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_ls_order_id_unique` UNIQUE(`ls_order_id`)
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`file_url` varchar(512) NOT NULL,
	`min_tier` enum('guide','insider') NOT NULL DEFAULT 'guide',
	`sort_order` int NOT NULL DEFAULT 0,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	CONSTRAINT `resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ls_subscription_id` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL,
	`renews_at` datetime,
	`ends_at` datetime,
	`raw` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_ls_subscription_id_unique` UNIQUE(`ls_subscription_id`)
);
--> statement-breakpoint
CREATE TABLE `updates_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`content_md` longtext NOT NULL,
	`min_tier` enum('guide','insider') NOT NULL DEFAULT 'guide',
	`published_at` datetime,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	CONSTRAINT `updates_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255),
	`name` varchar(255),
	`role` enum('admin','member') NOT NULL DEFAULT 'member',
	`tier` enum('none','guide','insider') NOT NULL DEFAULT 'none',
	`tier_expires_at` datetime,
	`ls_customer_id` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ls_event_id` varchar(128) NOT NULL,
	`event_name` varchar(64) NOT NULL,
	`processed_at` datetime,
	`error` text,
	`raw` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhook_events_ls_event_id_unique` UNIQUE(`ls_event_id`)
);
