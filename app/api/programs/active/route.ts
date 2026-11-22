import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getActiveProgram } from '@/lib/activeProgram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const program = await getActiveProgram();
  if (!program) return NextResponse.json(null);
  return NextResponse.json({ id: program.id, name: program.name });
}
