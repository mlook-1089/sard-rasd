import { NextResponse } from 'next/server';
import { identifyByPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password) return NextResponse.json({ error: 'كلمة المرور مطلوبة' }, { status: 400 });

  const session = await identifyByPassword(password);
  if (!session) return NextResponse.json({ error: 'كلمة مرور غير صحيحة' }, { status: 401 });

  await setSessionCookie(session);

  const redirect =
    session.role === 'admin' ? '/admin' :
    session.role === 'supervisor' ? '/supervisor' :
    session.role === 'reciter' ? '/reciter' :
    '/student';

  return NextResponse.json({ ok: true, role: session.role, redirect });
}
