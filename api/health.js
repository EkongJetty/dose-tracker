import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const out = {
    secretSet: !!process.env.SESSION_SECRET,
    secretLength: (process.env.SESSION_SECRET || '').length,
    databaseUrlSet: !!process.env.DATABASE_URL,
  };
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1 AS ok`;
    out.database = 'connected';
  } catch (e) {
    out.database = 'failed';
    out.error = String(e.message || e);
  }
  res.json(out);
}
