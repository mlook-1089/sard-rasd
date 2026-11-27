import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { settings, supervisors, students } from './schema';
import { and, eq, isNull, like, or } from 'drizzle-orm';

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

/** Resolve staff passwords only. Privileged entry is deliberately separated from student login. */
export async function identifyStaffByPassword(password: string): Promise<Session | null> {
  if (!password) return null;

  const [[s], sups] = await Promise.all([
    db.select().from(settings).where(eq(settings.id, 1)).limit(1),
    db.select().from(supervisors)
  ]);
  if (s) {
    const [isAdmin, isReciter] = await Promise.all([
      bcrypt.compare(password, s.adminPasswordHash),
      bcrypt.compare(password, s.reciterPasswordHash)
    ]);
    if (isAdmin) return { role: 'admin' };
    if (isReciter) return { role: 'reciter' };
  }

  const supervisorMatches = await Promise.all(sups.map((sup) => bcrypt.compare(password, sup.passwordHash)));
  const supervisorIndex = supervisorMatches.findIndex(Boolean);
  if (supervisorIndex >= 0) {
    const sup = sups[supervisorIndex];
    return { role: 'supervisor', id: sup.id, committeeId: sup.committeeId ?? undefined };
  }

  return null;
}

/** Resolve student credentials without scanning or hashing every account. */
export async function identifyStudentByPassword(password: string): Promise<Session | null> {
  const trimmedPassword = password.trim();
  if (!trimmedPassword) return null;

  const [directStudent] = await db
    .select({ id: students.id })
    .from(students)
    .where(or(eq(students.nationalId, trimmedPassword), eq(students.passwordHash, trimmedPassword)))
    .limit(1);
  if (directStudent) return { role: 'student', id: directStudent.id };

  const legacyStudents = await db
    .select({ id: students.id, passwordHash: students.passwordHash })
    .from(students)
    .where(and(isNull(students.nationalId), like(students.passwordHash, '$2%')));
  const legacyMatches = await Promise.all(
    legacyStudents.map((student) => bcrypt.compare(trimmedPassword, student.passwordHash))
  );
  const legacyIndex = legacyMatches.findIndex(Boolean);
  if (legacyIndex >= 0) {
    return { role: 'student', id: legacyStudents[legacyIndex].id };
  }

  return null;
}

/** Backwards-compatible unified resolver for internal checks. */
export async function identifyByPassword(password: string): Promise<Session | null> {
  return (await identifyStaffByPassword(password)) ?? (await identifyStudentByPassword(password));
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
  const trimmedPw = password.trim();
  for (const st of studs) {
    if (exclude?.kind === 'student' && exclude.id === st.id) continue;
    if ((st.nationalId && st.nationalId.trim() === trimmedPw) || st.passwordHash === trimmedPw) {
      return `student:${st.name}`;
    }
    if (!st.nationalId && st.passwordHash && st.passwordHash.startsWith('$2')) {
      if (await bcrypt.compare(trimmedPw, st.passwordHash)) return `student:${st.name}`;
    }
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
