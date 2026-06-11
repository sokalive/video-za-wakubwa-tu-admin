import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Admin } from "@/types";
import { verifyAdminPassword } from "@/lib/db/repository";
import { isDbConfigured } from "@/lib/db/client";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "vzwakubwa-admin-secret-key-2026"
);

const COOKIE_NAME = "vzw-admin-session";
const SESSION_DURATION = 60 * 60 * 24;

export interface SessionPayload {
  adminId: string;
  email: string;
  name: string;
  role: string;
  exp: number;
}

export async function createSession(admin: Admin): Promise<string> {
  const token = await new SignJWT({
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION}s`)
    .setIssuedAt()
    .sign(SECRET);

  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function validateCredentials(email: string, password: string): Promise<Admin | null> {
  if (!isDbConfigured()) {
    throw new Error("Database not configured. Set Supabase environment variables.");
  }
  return verifyAdminPassword(email, password);
}

export { COOKIE_NAME };
