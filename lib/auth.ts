import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { settings, supervisors, students } from './schema';
import { eq } from 'drizzle-orm';

export type Role = 'admin' | 'reciter' | 'supervisor' | 'student';

export type Session = {
  role: Role;
  id?: number;            // supervisor.id or student.id
  committeeId?: number;   // supervisor only
};

const COOKIE = 'sard_session';

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is missing or too short');
  return new TextEncoder().encode(s);
}

export async function sign(session: Session): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
}

export async function verify(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const c = cookies().get(COOKIE);
  if (!c?.value) return null;
  return await verify(c.value);
}

export async function setSessionCookie(session: Session) {
  const token = await sign(session);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

/** Try to resolve a submitted password against admin, reciter, supervisors, students (in that order). */
export async function identifyByPassword(password: string): Promise<Session | null> {
  if (!password) return null;

  const [s] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (s) {
    if (await bcrypt.compare(password, s.adminPasswordHash)) return { role: 'admin' };
    if (await bcrypt.compare(password, s.reciterPasswordHash)) return { role: 'reciter' };
  }

  const sups = await db.select().from(supervisors);
  for (const sup of sups) {
    if (await bcrypt.compare(password, sup.passwordHash)) {
      return { role: 'supervisor', id: sup.id, committeeId: sup.committeeId ?? undefined };
    }
  }

  const studs = await db.select().from(students);
  for (const st of studs) {
    if (await bcrypt.compare(password, st.passwordHash)) {
      return { role: 'student', id: st.id };
    }
  }

  return null;
}

/** Check whether a plaintext password already identifies ANY account — for collision warning. */
export async function passwordCollides(password: string, exclude?: { kind: Role | 'any'; id?: number }): Promise<string | null> {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (s) {
    if (exclude?.kind !== 'admin' && (await bcrypt.compare(password, s.adminPasswordHash))) return 'admin';
    if (exclude?.kind !== 'reciter' && (await bcrypt.compare(password, s.reciterPasswordHash))) return 'reciter';
  }
  const sups = await db.select().from(supervisors);
  for (const sup of sups) {
    if (exclude?.kind === 'supervisor' && exclude.id === sup.id) continue;
    if (await bcrypt.compare(password, sup.passwordHash)) return `supervisor:${sup.username}`;
  }
  const studs = await db.select().from(students);
  for (const st of studs) {
    if (exclude?.kind === 'student' && exclude.id === st.id) continue;
    if (await bcrypt.compare(password, st.passwordHash)) return `student:${st.name}`;
  }
  return null;
}

export async function hash(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export function randomPassword(len = 6): string {
  // Short numeric passwords for students (easy to remember / distribute)
  const digits = '0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += digits[Math.floor(Math.random() * 10)];
  return s;
}

export function randomStrongPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function randomToken(len = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
