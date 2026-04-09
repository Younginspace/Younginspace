/**
 * Database Relations
 *
 * Define app-level Drizzle ORM relations here.
 */

import { relations } from "drizzle-orm";
import { messages } from "./db_schema";
import { esSystemAuthUser } from "../__generated__/sys_schema";

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(esSystemAuthUser, {
    fields: [messages.user_id],
    references: [esSystemAuthUser.id],
  }),
}));
