import { db } from './db';
import { settings } from './schema';
import { eq } from 'drizzle-orm';

export async function getGrading() {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return {
    total: s?.totalScore ?? 100,
    pass: s?.passThreshold ?? 60,
    errDeduct: s?.errorDeduction ?? 2,
    alertDeduct: s?.alertDeduction ?? 1,
    slow: s?.slowSessionMinutes ?? 5,
    stuck: s?.stuckSessionMinutes ?? 10
  };
}

export function computeScore(
  total: number,
  errDeduct: number,
  alertDeduct: number,
  errors: number,
  alerts: number
): number {
  return Math.max(0, total - errors * errDeduct - alerts * alertDeduct);
}
