CREATE TABLE `message_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `es_system__auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_likes_unique_idx` ON `message_likes` (`message_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `message_likes_message_id_idx` ON `message_likes` (`message_id`);--> statement-breakpoint
ALTER TABLE `messages` ADD `admin_reply` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `admin_reply_at` text;