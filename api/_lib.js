import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

export const sql = neon(process.env.DATABASE_URL);
export const MAX_USERS = 10;
export const ROLES = ['radiographer', 'radiologist', 'physicist', 'rso', 'admin'];
const SECRET = process.env.SESSION_SECRET || '';
const COOKIE = 'dt_session';
const MAXAGE = 60 * 60 * 12; // 12 hours

let ready;
export const init = () => (ready ||= (async () => {
  await sql`CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text UNIQUE NOT NULL, data jsonb NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS records (store text NOT NULL, id text NOT NULL, data jsonb NOT NULL, PRIMARY KEY (store, id))`;
})());

/* passwords: scrypt with a per-user salt */
export const hashPw = (pw, saltHex) => {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  return { salt: salt.toString('hex'), hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
};
export const samePw = (pw, u) => {
  const h = hashPw(pw, u.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'));
};

/* sessions: signed, HttpOnly cookie */
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
export const sessionCookie = (uid) => {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + MAXAGE * 1000 })).toString('base64url');
  return `${COOKIE}=${body}.${mac(body)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAXAGE}`;
};
export const clearCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export async function currentUser(req) {
  if (!SECRET) throw new Error('SESSION_SECRET is not set');
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!p.uid || p.exp < Date.now()) return null;
  const r = await sql`SELECT data FROM users WHERE id = ${p.uid}`;
  return r[0] ? r[0].data : null;
}

export const publicUser = (u) => {
  const { salt, hash, fails, until, ...rest } = u;
  return rest;
};
