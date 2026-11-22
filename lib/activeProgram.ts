import { db } from './db';
import { programs } from './schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * Returns the single active program. Must always exist — migrate.ts ensures it.
 * Any route that writes attendance or starts a session should call this and
 * attach the returned id.
 */
export async function getActiveProgram() {
  const rows = await db.select().from(programs)
    .where(and(eq(programs.isActive, true), isNull(programs.archivedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getActiveProgramId(): Promise<number | null> {
  const p = await getActiveProgram();
  return p?.id ?? null;
}
