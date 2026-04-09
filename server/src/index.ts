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
import { messages } from "@defs";
import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";

const ADMIN_EMAIL = "thomasyang3115@gmail.com";

function isAdmin(): boolean {
  return auth.isAuthenticated() && auth.user!.email === ADMIN_EMAIL;
}

const app = new Hono()

  // Public: get visible messages (newest first)
  .get("/api/public/messages", async (c) => {
    const rows = await db
      .select({
        id: messages.id,
        user_name: messages.user_name,
        content: messages.content,
        created_at: messages.created_at,
      })
      .from(messages)
      .where(eq(messages.visible, 1))
      .orderBy(desc(messages.created_at))
      .limit(100);
    return c.json({ messages: rows });
  })

  // Public: check if current user is admin
  .get("/api/public/me", (c) => {
    if (!auth.isAuthenticated()) {
      return c.json({ user: null, isAdmin: false });
    }
    return c.json({
      user: { id: auth.user!.id, name: auth.user!.name, email: auth.user!.email },
      isAdmin: isAdmin(),
    });
  })

  // Auth required: post a message
  .post("/api/messages", async (c) => {
    const { content } = await c.req.json<{ content: string }>();
    if (!content || content.trim().length === 0) {
      return c.json({ error: "Content is required" }, 400);
    }
    if (content.length > 500) {
      return c.json({ error: "Content too long (max 500)" }, 400);
    }
    const user = auth.user!;
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

  // Admin: get ALL messages (including hidden)
  .get("/api/messages/admin", async (c) => {
    if (!isAdmin()) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const rows = await db
      .select()
      .from(messages)
      .orderBy(desc(messages.created_at))
      .limit(200);
    return c.json({ messages: rows });
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

  // Admin: delete message
  .delete("/api/messages/:id", async (c) => {
    if (!isAdmin()) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const id = parseInt(c.req.param("id"), 10);
    await db.delete(messages).where(eq(messages.id, id));
    return c.json({ success: true });
  });

export default app;
