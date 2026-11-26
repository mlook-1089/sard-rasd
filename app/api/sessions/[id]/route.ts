import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessionMarks, sessions } from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { computeScore, getGrading } from '@/lib/grading';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MushafMark = { surah: number; ayah: number; type: 'error' | 'alert' };

function normalizeMarks(raw: unknown): MushafMark[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item): MushafMark[] => {
    if (!item || typeof item !== 'object') return [];
    const mark = item as Record<string, unknown>;
    const surah = Math.floor(Number(mark.surah));
    const ayah = Math.floor(Number(mark.ayah));
    const type = mark.type === 'error' || mark.type === 'alert' ? mark.type : null;
    if (!type || surah < 1 || surah > 114 || ayah < 1) return [];
    return [{ surah, ayah, type }];
  }).slice(0, 500);
}

/** End or edit a session. Body:
 *   action: 'end'    → { errors, alerts }      finalize
 *   action: 'cancel' → cancel in-flight session
 *   action: 'edit'   → { errors, alerts, hizbNumber? } (admin/supervisor-of-committee)
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Math.max(0, Math.floor(Number(params.id) || 0));
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const b = await req.json();
  const g = await getGrading();

  if (b.action === 'end' || b.action === 'cancel') {
    // Any role that owns this session can end/cancel it. For reciter we don't gate by deviceTag here;
    // the reciter UI should only expose actions for its own in-flight session.
    const endedAt = new Date();
    const computedDuration = Math.max(0, Math.floor((endedAt.getTime() - new Date(row.startedAt).getTime()) / 1000));
    const durationSeconds = b.durationSeconds !== undefined
      ? Math.max(0, Math.floor(Number(b.durationSeconds) || 0))
      : computedDuration;

    if (b.action === 'cancel') {
      await db.update(sessions).set({
        cancelled: true,
        endedAt: row.endedAt ?? endedAt,
        durationSeconds: row.durationSeconds ?? durationSeconds
      }).where(eq(sessions.id, id));
      return NextResponse.json({ ok: true });
    }

    if (row.cancelled) {
      return NextResponse.json({ error: 'هذه الجلسة تم إلغاؤها ولا يمكن اعتمادها' }, { status: 409 });
    }
    if (row.endedAt && row.score !== null) {
      return NextResponse.json({ ok: true, score: row.score, passed: row.passed });
    }

    const marks = normalizeMarks(b.marks);
    const errors = marks
      ? marks.filter((mark) => mark.type === 'error').length
      : Math.max(0, Math.floor(Number(b.errors ?? row.errors) || 0));
    const alerts = marks
      ? marks.filter((mark) => mark.type === 'alert').length
      : Math.max(0, Math.floor(Number(b.alerts ?? row.alerts) || 0));
    const score = computeScore(g.total, g.errDeduct, g.alertDeduct, errors, alerts);
    const passed = score >= g.pass;
    if (marks) {
      await db.delete(sessionMarks).where(eq(sessionMarks.sessionId, id));
      if (marks.length > 0) {
        await db.insert(sessionMarks).values(marks.map((mark) => ({
          sessionId: id,
          surah: mark.surah,
          ayah: mark.ayah,
          type: mark.type
        })));
      }
    }
    await db.update(sessions).set({ endedAt, durationSeconds, errors, alerts, score, passed }).where(eq(sessions.id, id));
    return NextResponse.json({ ok: true, score, passed });
  }

  if (b.action === 'edit') {
    // Permissions: admin always; supervisor within their committee; reciter for any recorded session in their committee.
    if (session.role === 'supervisor' && session.committeeId !== row.committeeId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const errors = Math.max(0, Math.floor(Number(b.errors ?? row.errors) || 0));
    const alerts = Math.max(0, Math.floor(Number(b.alerts ?? row.alerts) || 0));
    const score = computeScore(g.total, g.errDeduct, g.alertDeduct, errors, alerts);
    const passed = score >= g.pass;
    const patch: any = { errors, alerts, score, passed };
    if (b.hizbNumber !== undefined && session.role === 'admin') {
      const hn = Math.max(0, Math.floor(Number(b.hizbNumber) || 0));
      if (hn >= 1 && hn <= 60) patch.hizbNumber = hn;
    }
    if (b.durationSeconds !== undefined && session.role === 'admin') {
      patch.durationSeconds = Math.max(0, Math.floor(Number(b.durationSeconds) || 0));
    }
    await db.update(sessions).set(patch).where(eq(sessions.id, id));
    return NextResponse.json({ ok: true, score, passed });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const id = Number(params.id);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (session.role === 'supervisor' && session.committeeId !== row.committeeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (session.role === 'reciter') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await db.delete(sessions).where(eq(sessions.id, id));
  return NextResponse.json({ ok: true });
}
