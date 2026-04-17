/**
 * EDGESPARK SERVER
 *
 * ═══════════════════════════════════════════════════════════════════
 * PATH CONVENTIONS (Authentication)
 *
 * /api/*          → Login required (auth.user guaranteed)
 * /api/public/*   → Login optional (auth.user if logged in)
 * /api/webhooks/* → No auth check (handle verification yourself)
 * ═══════════════════════════════════════════════════════════════════
 */

import { db } from "edgespark";
import { auth } from "edgespark/http";
import { messages, messageLikes } from "@defs";
import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";

const ADMIN_EMAIL = "thomasyang3115@gmail.com";

function isAdmin(): boolean {
  return auth.isAuthenticated() && auth.user!.email === ADMIN_EMAIL;
}

type MessageRow = {
  id: number;
  user_id?: string;
  user_name: string;
  content: string;
  visible?: number;
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
  like_count: number | string | null;
  has_liked: number | string | null;
};

function shape(row: MessageRow, includeVisible = false) {
  const base: Record<string, unknown> = {
    id: row.id,
    user_name: row.user_name,
    content: row.content,
    created_at: row.created_at,
    admin_reply: row.admin_reply,
    admin_reply_at: row.admin_reply_at,
    like_count: Number(row.like_count ?? 0),
    has_liked: Number(row.has_liked ?? 0) === 1,
  };
  if (includeVisible) base.visible = Number(row.visible ?? 1);
  return base;
}

const app = new Hono()

  // Public: visible messages with like counts + per-user has_liked
  .get("/api/public/messages", async (c) => {
    const me = auth.isAuthenticated() ? auth.user!.id : null;
    const rows = await db
      .select({
        id: messages.id,
        user_name: messages.user_name,
        content: messages.content,
        created_at: messages.created_at,
        admin_reply: messages.admin_reply,
        admin_reply_at: messages.admin_reply_at,
        like_count: sql<number>`count(${messageLikes.id})`,
        has_liked: me
          ? sql<number>`coalesce(max(case when ${messageLikes.user_id} = ${me} then 1 else 0 end), 0)`
          : sql<number>`0`,
      })
      .from(messages)
      .leftJoin(messageLikes, eq(messageLikes.message_id, messages.id))
      .where(eq(messages.visible, 1))
      .groupBy(messages.id)
      .orderBy(desc(messages.created_at))
      .limit(100);
    return c.json({ messages: rows.map((r) => shape(r as MessageRow)) });
  })

  // Public: current user + isAdmin
  .get("/api/public/me", (c) => {
    if (!auth.isAuthenticated()) {
      return c.json({ user: null, isAdmin: false });
    }
    return c.json({
      user: { id: auth.user!.id, name: auth.user!.name, email: auth.user!.email },
      isAdmin: isAdmin(),
    });
  })

  // Auth: list my own messages (includes hidden)
  .get("/api/messages/mine", async (c) => {
    const me = auth.user!.id;
    const rows = await db
      .select({
        id: messages.id,
        user_name: messages.user_name,
        content: messages.content,
        created_at: messages.created_at,
        visible: messages.visible,
        admin_reply: messages.admin_reply,
        admin_reply_at: messages.admin_reply_at,
        like_count: sql<number>`count(${messageLikes.id})`,
        has_liked: sql<number>`coalesce(max(case when ${messageLikes.user_id} = ${me} then 1 else 0 end), 0)`,
      })
      .from(messages)
      .leftJoin(messageLikes, eq(messageLikes.message_id, messages.id))
      .where(eq(messages.user_id, me))
      .groupBy(messages.id)
      .orderBy(desc(messages.created_at));
    return c.json({ messages: rows.map((r) => shape(r as MessageRow, true)) });
  })

  // Auth: post a message (one per user — hidden messages still count)
  .post("/api/messages", async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    if (!content || content.trim().length === 0) {
      return c.json({ error: "Content is required" }, 400);
    }
    if (content.length > 500) {
      return c.json({ error: "Content too long (max 500)" }, 400);
    }
    const user = auth.user!;

    const existing = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.user_id, user.id))
      .limit(1);
    if (existing.length > 0) {
      return c.json({ error: "already_posted" }, 409);
    }

    const userName: string = user.name || user.email || "Anonymous";
    const [row] = await db
      .insert(messages)
      .values({
        user_id: user.id,
        user_name: userName,
        content: content.trim(),
      })
      .returning();
    return c.json({ message: row }, 201);
  })

  // Auth: delete a message (owner or admin)
  .delete("/api/messages/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id)) return c.json({ error: "Bad id" }, 400);

    const [row] = await db
      .select({ user_id: messages.user_id })
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1);
    if (!row) return c.json({ error: "Not found" }, 404);
    if (!isAdmin() && row.user_id !== auth.user!.id) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await db.delete(messages).where(eq(messages.id, id));
    return c.json({ success: true });
  })

  // Admin: list ALL messages (including hidden) with like counts
  .get("/api/messages/admin", async (c) => {
    if (!isAdmin()) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const me = auth.user!.id;
    const rows = await db
      .select({
        id: messages.id,
        user_name: messages.user_name,
        content: messages.content,
        created_at: messages.created_at,
        visible: messages.visible,
        admin_reply: messages.admin_reply,
        admin_reply_at: messages.admin_reply_at,
        like_count: sql<number>`count(${messageLikes.id})`,
        has_liked: sql<number>`coalesce(max(case when ${messageLikes.user_id} = ${me} then 1 else 0 end), 0)`,
      })
      .from(messages)
      .leftJoin(messageLikes, eq(messageLikes.message_id, messages.id))
      .groupBy(messages.id)
      .orderBy(desc(messages.created_at))
      .limit(200);
    return c.json({ messages: rows.map((r) => shape(r as MessageRow, true)) });
  })

  // Admin: toggle visibility
  .patch("/api/messages/:id/visibility", async (c) => {
    if (!isAdmin()) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const id = parseInt(c.req.param("id"), 10);
    const { visible } = await c.req.json<{ visible: number }>();
    await db
      .update(messages)
      .set({ visible: visible ? 1 : 0 })
      .where(eq(messages.id, id));
    return c.json({ success: true });
  })

  // Admin: set / update / clear admin reply
  .patch("/api/messages/:id/reply", async (c) => {
    if (!isAdmin()) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id)) return c.json({ error: "Bad id" }, 400);
    const { reply } = await c.req.json<{ reply: string | null }>();
    const trimmed = typeof reply === "string" ? reply.trim() : "";
    if (trimmed.length > 500) {
      return c.json({ error: "Reply too long (max 500)" }, 400);
    }
    await db
      .update(messages)
      .set({
        admin_reply: trimmed ? trimmed : null,
        admin_reply_at: trimmed ? sql`(current_timestamp)` : null,
      })
      .where(eq(messages.id, id));
    return c.json({
      success: true,
      admin_reply: trimmed || null,
      admin_reply_at: trimmed ? new Date().toISOString().replace("T", " ").slice(0, 19) : null,
    });
  })

  // Auth: like a message (idempotent via unique index)
  .post("/api/messages/:id/like", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id)) return c.json({ error: "Bad id" }, 400);
    const me = auth.user!.id;

    await db
      .insert(messageLikes)
      .values({ message_id: id, user_id: me })
      .onConflictDoNothing();

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageLikes)
      .where(eq(messageLikes.message_id, id));
    return c.json({ like_count: Number(count), has_liked: true });
  })

  // Auth: unlike a message
  .delete("/api/messages/:id/like", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id)) return c.json({ error: "Bad id" }, 400);
    const me = auth.user!.id;

    await db
      .delete(messageLikes)
      .where(and(eq(messageLikes.message_id, id), eq(messageLikes.user_id, me)));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageLikes)
      .where(eq(messageLikes.message_id, id));
    return c.json({ like_count: Number(count), has_liked: false });
  });

export default app;
