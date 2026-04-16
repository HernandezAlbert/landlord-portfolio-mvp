import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "lp_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing");
  return new TextEncoder().encode(secret);
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

async function setSessionCookie(user: { id: string; email: string }) {
  const token = await new SignJWT({ sub: user.id, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const jar = await cookies();

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function isAdminEmail(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return normalizeEmail(email) === normalizeEmail(adminEmail);
}

export async function signIn(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  const ok = await verifyPassword(password, user.passwordHash);

  if (!ok) {
    return { ok: false as const, error: "Invalid credentials" };
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      digestEmailTo: user.email,
      replyToEmail: user.email,
    },
  });

  await setSessionCookie({
    id: user.id,
    email: user.email,
  });

  return { ok: true as const };
}

export async function createUserAndSignIn(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { ok: false as const, error: "Email is required" };
  }

  if (password.length < 8) {
    return {
      ok: false as const,
      error: "Password must be at least 8 characters",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    return {
      ok: false as const,
      error: "An account with this email already exists",
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
      },
    });

    await tx.userSettings.create({
      data: {
        userId: createdUser.id,
        digestEmailTo: createdUser.email,
        replyToEmail: createdUser.email,
      },
    });

    return createdUser;
  });

  await setSessionCookie(user);

  return { ok: true as const };
}

export async function signOut() {
  const jar = await cookies();

  jar.set(COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    if (!payload.sub) return null;

    return {
      id: String(payload.sub),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("Unauthenticated");
  }

  return user;
}

export async function requireAdminSessionUser() {
  const user = await requireSessionUser();

  if (!isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }

  return user;
}