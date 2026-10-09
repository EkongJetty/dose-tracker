import { sql, init, MAX_USERS, hashPw, samePw, sessionCookie, clearCookie, currentUser, publicUser } from './_lib.js';
import crypto from 'node:crypto';

const PICKABLE = ['radiographer', 'radiologist', 'physicist', 'rso'];
const DUMMY = hashPw('not-a-real-password');
const bad = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  try {
    await init();
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
    const me = await currentUser(req);

    if (req.method === 'GET') return res.json({ user: me ? publicUser(me) : null, count: n, max: MAX_USERS });
    if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');
    const b = req.body || {};

    if (b.action === 'signout') { res.setHeader('Set-Cookie', clearCookie()); return res.json({ ok: true }); }

    if (b.action === 'signup') {
      const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
      const staff = String(b.staff || '').trim(), pw = String(b.password || '');
      if (name.length < 2) return bad(res, 400, 'Enter your full name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 400, 'Enter a valid work email, like name@hospital.org.');
      if (staff.length < 3) return bad(res, 400, 'Enter your staff or licence ID.');
      if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return bad(res, 400, 'Choose a password with 8 or more characters, including a letter and a number.');
      if (n >= MAX_USERS) return bad(res, 403, `All ${MAX_USERS} accounts are in use. Ask an administrator to remove one, then try again.`);
      const first = n === 0, role = first ? 'admin' : b.role;
      if (!first && !PICKABLE.includes(role)) return bad(res, 400, 'Choose a role from the list.');
      const { salt, hash } = hashPw(pw);
      const id = crypto.randomBytes(8).toString('hex');
      const u = { id, name, email, staff, role, salt, hash, created: Date.now(), profile: null };
      try { await sql`INSERT INTO users (id, email, data) VALUES (${id}, ${email}, ${JSON.stringify(u)}::jsonb)`; }
      catch (e) { if (String(e.code) === '23505') return bad(res, 409, 'An account with this email already exists. Sign in instead.'); throw e; }
      res.setHeader('Set-Cookie', sessionCookie(id));
      return res.json({ user: publicUser(u) });
    }

    if (b.action === 'signin') {
      const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      const r = await sql`SELECT data FROM users WHERE email = ${email}`;
      const u = r[0] && r[0].data;
      if (u && u.until && Date.now() < u.until) return bad(res, 429, `Too many attempts. Try again in ${Math.ceil((u.until - Date.now()) / 1000)} seconds.`);
      let ok = false;
      try { ok = samePw(pw, u || DUMMY) && !!u; } catch { ok = false; }
      if (!ok) {
        if (u) {
          const fails = (u.fails || 0) + 1, until = fails >= 5 ? Date.now() + 30000 : 0;
          await sql`UPDATE users SET data = data || ${JSON.stringify({ fails: fails >= 5 ? 0 : fails, until })}::jsonb WHERE id = ${u.id}`;
        }
        return bad(res, 401, 'Email or password is incorrect.');
      }
      if (u.fails || u.until) await sql`UPDATE users SET data = data || '{"fails":0,"until":0}'::jsonb WHERE id = ${u.id}`;
      res.setHeader('Set-Cookie', sessionCookie(u.id));
      return res.json({ user: publicUser(u) });
    }

    if (b.action === 'password') {
      if (!me) return bad(res, 401, 'Please sign in again.');
      const np = String(b.newPassword || '');
      if (!samePw(String(b.oldPassword || ''), me)) return bad(res, 400, 'Your current password is incorrect.');
      if (np.length < 8 || !/[A-Za-z]/.test(np) || !/\d/.test(np)) return bad(res, 400, 'Choose a password with 8 or more characters, including a letter and a number.');
      await sql`UPDATE users SET data = data || ${JSON.stringify(hashPw(np))}::jsonb WHERE id = ${me.id}`;
      return res.json({ ok: true });
    }

    return bad(res, 400, 'Unknown action');
  } catch (e) {
    console.error(e);
    return bad(res, 500, 'Server error. Please try again.');
  }
}
