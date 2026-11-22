import { NextResponse } from 'next/server';
import { getSession, type Role, type Session } from './auth';

export async function requireRole(roles: Role[]): Promise<{ ok: true; session: Session } | { ok: false; res: NextResponse }> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) {
    return { ok: false, res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  return { ok: true, session };
}
