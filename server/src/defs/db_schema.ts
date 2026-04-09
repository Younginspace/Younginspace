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
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { esSystemAuthUser } from "../__generated__/sys_schema";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  user_id: text("user_id").notNull().references(() => esSystemAuthUser.id, { onDelete: "cascade" }),
  user_name: text("user_name").notNull(),
  content: text("content").notNull(),
  visible: integer("visible").notNull().default(1),
  created_at: text("created_at").notNull().default(sql`(current_timestamp)`),
}, (table) => [
  index("messages_user_id_idx").on(table.user_id),
  index("messages_created_at_idx").on(table.created_at),
]);
