/**
 * Database Schema
 *
 * Define your app tables here using Drizzle ORM.
 * If you want app-level `relations(...)`, define them in `src/defs/db_relations.ts`.
 *
 * After making changes, run:
 *   edgespark db generate   (create migration files)
 *   edgespark db migrate    (apply to the project database)
 *   edgespark deploy        (deploy with latest schema)
 */

import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { esSystemAuthUser } from "../__generated__/sys_schema";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull().references(() => esSystemAuthUser.id, { onDelete: "cascade" }),
  user_name: text("user_name").notNull(),
  content: text("content").notNull(),
  visible: integer("visible").notNull().default(1),
  admin_reply: text("admin_reply"),
  admin_reply_at: text("admin_reply_at"),
  created_at: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (table) => [
  index("messages_user_id_idx").on(table.user_id),
  index("messages_created_at_idx").on(table.created_at),
]);

export const messageLikes = sqliteTable("message_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  message_id: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => esSystemAuthUser.id, { onDelete: "cascade" }),
  created_at: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (table) => [
  uniqueIndex("message_likes_unique_idx").on(table.message_id, table.user_id),
  index("message_likes_message_id_idx").on(table.message_id),
]);
