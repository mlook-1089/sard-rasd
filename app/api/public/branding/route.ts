import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [row] = await db
    .select({ logoUrl: settings.logoUrl })
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);

  return NextResponse.json(
    { logoUrl: row?.logoUrl || null },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
