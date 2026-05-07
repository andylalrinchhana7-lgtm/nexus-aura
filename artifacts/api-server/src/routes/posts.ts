import { Router, type IRouter } from "express";
import { db, postsTable, postLikesTable, commentsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

async function enrichPost(
  post: typeof postsTable.$inferSelect,
  requestingUserId?: string
) {
  const [likeRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, post.id));

  const [commentRow] = await db
    .select({ count: sql<string>`count(*)` })
    .from(commentsTable)
    .where(eq(commentsTable.postId, post.id));

  let likedByMe = false;
  if (requestingUserId) {
    const [like] = await db
      .select()
      .from(postLikesTable)
      .where(
        and(
          eq(postLikesTable.postId, post.id),
          eq(postLikesTable.userId, requestingUserId)
        )
      );
    likedByMe = !!like;
  }

  return {
    id: post.id,
    userId: post.userId,
    username: post.username,
    avatarColor: post.avatarColor,
    text: post.text ?? undefined,
    mediaUrl: post.mediaUrl ?? undefined,
    mediaType: post.mediaType ?? undefined,
    createdAt: post.createdAt.toISOString(),
    likes: Number(likeRow?.count ?? 0),
    comments: Number(commentRow?.count ?? 0),
    likedByMe,
  };
}

// ─── GET /posts ───────────────────────────────────────────────────────────────

router.get("/posts", async (req, res): Promise<void> => {
  const requestingUserId = (req.query.userId as string) || undefined;

  const posts = await db
    .select()
    .from(postsTable)
    .orderBy(desc(postsTable.createdAt))
    .limit(50);

  const enriched = await Promise.all(posts.map((p) => enrichPost(p, requestingUserId)));
  res.json(enriched);
});

// ─── POST /posts ──────────────────────────────────────────────────────────────

router.post("/posts", async (req, res): Promise<void> => {
  const { userId, username, avatarColor, text, mediaUrl, mediaType } = req.body as {
    userId?: string;
    username?: string;
    avatarColor?: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
  };

  if (!userId || !username || !avatarColor) {
    res.status(400).json({ error: "userId, username, and avatarColor are required" });
    return;
  }
  if (!text?.trim() && !mediaUrl) {
    res.status(400).json({ error: "Post must have text or media" });
    return;
  }

  const id = randomUUID();
  const [post] = await db
    .insert(postsTable)
    .values({
      id,
      userId,
      username,
      avatarColor,
      text: text?.trim() || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
    })
    .returning();

  if (!post) {
    res.status(500).json({ error: "Failed to create post" });
    return;
  }

  req.log.info({ postId: post.id, userId }, "Post created");
  res.status(201).json(await enrichPost(post, userId));
});

// ─── PATCH /posts/:id/like ────────────────────────────────────────────────────

router.patch("/posts/:id/like", async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = req.body as { userId?: string };

  if (!postId || !userId) {
    res.status(400).json({ error: "postId and userId are required" });
    return;
  }

  const [existing] = await db
    .select()
    .from(postLikesTable)
    .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)));

  let likedByMe: boolean;
  if (existing) {
    await db
      .delete(postLikesTable)
      .where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)));
    likedByMe = false;
  } else {
    await db.insert(postLikesTable).values({ postId, userId });
    likedByMe = true;
  }

  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(postLikesTable)
    .where(eq(postLikesTable.postId, postId));

  res.json({ likedByMe, likes: Number(row?.count ?? 0) });
});

// ─── GET /posts/:id/comments ──────────────────────────────────────────────────

router.get("/posts/:id/comments", async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!postId) {
    res.status(400).json({ error: "postId is required" });
    return;
  }

  const rows = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.postId, postId))
    .orderBy(commentsTable.createdAt);

  res.json(
    rows.map((c) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      username: c.username,
      avatarColor: c.avatarColor,
      text: c.text,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

// ─── POST /posts/:id/comments ─────────────────────────────────────────────────

router.post("/posts/:id/comments", async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId, username, avatarColor, text } = req.body as {
    userId?: string;
    username?: string;
    avatarColor?: string;
    text?: string;
  };

  if (!postId || !userId || !username || !avatarColor || !text?.trim()) {
    res.status(400).json({ error: "postId, userId, username, avatarColor, and text are required" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const id = randomUUID();
  const [comment] = await db
    .insert(commentsTable)
    .values({ id, postId, userId, username, avatarColor, text: text.trim() })
    .returning();

  if (!comment) {
    res.status(500).json({ error: "Failed to create comment" });
    return;
  }

  req.log.info({ commentId: id, postId, userId }, "Comment added");
  res.status(201).json({
    id: comment.id,
    postId: comment.postId,
    userId: comment.userId,
    username: comment.username,
    avatarColor: comment.avatarColor,
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
  });
});

// ─── DELETE /posts/:id ────────────────────────────────────────────────────────

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const postId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { userId } = req.body as { userId?: string };

  if (!postId || !userId) {
    res.status(400).json({ error: "postId and userId are required" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.userId !== userId) {
    res.status(403).json({ error: "Only the post author can delete it" });
    return;
  }

  await db.delete(commentsTable).where(eq(commentsTable.postId, postId));
  await db.delete(postLikesTable).where(eq(postLikesTable.postId, postId));
  await db.delete(postsTable).where(eq(postsTable.id, postId));

  req.log.info({ postId, userId }, "Post deleted");
  res.json({ success: true });
});

export default router;
