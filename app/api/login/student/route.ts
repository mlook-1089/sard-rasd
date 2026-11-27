import { NextResponse } from 'next/server';
import { identifyStudentByPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password?.trim()) {
    return NextResponse.json({ error: 'رقم الهوية أو كلمة المرور مطلوبة' }, { status: 400 });
  }

  const session = await identifyStudentByPassword(password);
  if (!session) {
    return NextResponse.json({ error: 'بيانات الطالب غير صحيحة' }, { status: 401 });
  }

  await setSessionCookie(session);
  return NextResponse.json(
    { ok: true, role: 'student', redirect: '/student' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
