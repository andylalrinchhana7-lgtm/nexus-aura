import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { db, usersTable, otpCodesTable, pushTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const router: IRouter = Router();

const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#00a884", "#F39C12", "#E74C3C", "#9B59B6", "#1ABC9C",
];

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!;
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const { username, email } = req.body as { username?: string; email?: string };

  if (!username?.trim() || !email?.trim()) {
    res.status(400).json({ error: "username and email are required" });
    return;
  }

  const normalEmail = email.trim().toLowerCase();
  const normalUsername = username.trim();

  // Upsert user (allow re-registration with same email for dev simplicity)
  let user = (await db.select().from(usersTable).where(eq(usersTable.email, normalEmail)))[0];

  if (!user) {
    const id = randomUUID();
    const avatarColor = randomColor();
    [user] = await db
      .insert(usersTable)
      .values({ id, username: normalUsername, email: normalEmail, avatarColor })
      .returning();
  }

  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db.insert(otpCodesTable).values({
    id: randomUUID(),
    userId: user.id,
    email: normalEmail,
    code: otp,
    expiresAt,
  });

  req.log.info({ userId: user.id }, "User registered, OTP generated");

  res.status(200).json({
    userId: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
    otp, // Returned in dev — in production this would be emailed
  });
});

// POST /auth/verify-otp
router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string };

  if (!email?.trim() || !otp?.trim()) {
    res.status(400).json({ error: "email and otp are required" });
    return;
  }

  const normalEmail = email.trim().toLowerCase();

  const [record] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.email, normalEmail),
        eq(otpCodesTable.code, otp.trim()),
        gt(otpCodesTable.expiresAt, new Date())
      )
    )
    .orderBy(otpCodesTable.createdAt)
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Invalid or expired OTP" });
    return;
  }

  // Mark as used
  await db
    .update(otpCodesTable)
    .set({ usedAt: new Date() })
    .where(eq(otpCodesTable.id, record.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, record.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  req.log.info({ userId: user.id }, "OTP verified");

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
  });
});

// POST /auth/push-token
router.post("/auth/push-token", async (req, res): Promise<void> => {
  const { userId, token } = req.body as { userId?: string; token?: string };

  if (!userId || !token) {
    res.status(400).json({ error: "userId and token are required" });
    return;
  }

  // Upsert: delete existing token for this user+token combo, then insert
  const existing = await db
    .select()
    .from(pushTokensTable)
    .where(eq(pushTokensTable.token, token));

  if (existing.length === 0) {
    await db.insert(pushTokensTable).values({
      id: randomUUID(),
      userId,
      token,
    });
    req.log.info({ userId }, "Push token registered");
  }

  res.json({ success: true });
});

export default router;
