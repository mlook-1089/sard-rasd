import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Lazy init: Next.js app-router collects page data during build; we must not call
// neon() at module load time, because the URL may be absent or invalid at that
// point. Instead, create the client on first use.
let _sql: NeonQueryFunction<any, any> | null = null;
let _db: NeonHttpDatabase<typeof schema> | null = null;

function getSql(): NeonQueryFunction<any, any> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not configured');
  _sql = neon(url, { fetchOptions: { cache: 'no-store' } });
  return _sql;
}

export const db: NeonHttpDatabase<typeof schema> = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_t, prop) {
    if (!_db) _db = drizzle(getSql(), { schema });
    return (_db as any)[prop];
  }
});

export { schema };
