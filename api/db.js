import { sql, init, ROLES, currentUser, publicUser } from './_lib.js';

const STORES = ['patients', 'exams', 'meta', 'users'];
const WRITERS = ['radiographer', 'radiologist', 'rso', 'admin'];
const bad = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  try {
    await init();
    const me = await currentUser(req);
    if (!me) return bad(res, 401, 'Please sign in again.');
    const { store, id, action } = req.query;
    if (!STORES.includes(store)) return bad(res, 400, 'Unknown store');
    const admin = me.role === 'admin';

    /* ---- accounts ---- */
    if (store === 'users') {
      if (req.method === 'GET') {
        if (id) {
          if (id !== me.id && !admin) return bad(res, 403, 'Not allowed');
          const r = await sql`SELECT data FROM users WHERE id = ${id}`;
          return res.json({ row: r[0] ? publicUser(r[0].data) : null });
        }
        if (!admin) return res.json({ rows: [publicUser(me)] });
        const r = await sql`SELECT data FROM users`;
        return res.json({ rows: r.map((x) => publicUser(x.data)) });
      }
      if (req.method === 'PUT') {
        const b = req.body || {};
        if (b.id === me.id) {            // you may update your own questionnaire answers
          if (b.profile && typeof b.profile === 'object')
            await sql`UPDATE users SET data = data || ${JSON.stringify({ profile: b.profile })}::jsonb WHERE id = ${me.id}`;
          return res.json({ ok: true });
        }
        if (!admin || !ROLES.includes(b.role)) return bad(res, 403, 'Only administrators can change roles');
        await sql`UPDATE users SET data = data || ${JSON.stringify({ role: b.role })}::jsonb WHERE id = ${b.id}`;
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        if (!admin || !id || id === me.id) return bad(res, 403, 'Not allowed');
        await sql`DELETE FROM users WHERE id = ${id}`;
        return res.json({ ok: true });
      }
      return bad(res, 405, 'Method not allowed');
    }

    /* ---- patients, exams, app settings ---- */
    if (req.method === 'GET') {
      if (id) {
        const r = await sql`SELECT data FROM records WHERE store = ${store} AND id = ${id}`;
        return res.json({ row: r[0] ? r[0].data : null });
      }
      const r = await sql`SELECT data FROM records WHERE store = ${store}`;
      return res.json({ rows: r.map((x) => x.data) });
    }
    if (req.method === 'PUT') {
      const b = req.body || {}, rid = b.id || b.key;
      if (!rid) return bad(res, 400, 'Missing id');
      if (store !== 'meta' && !WRITERS.includes(me.role)) return bad(res, 403, 'Your role cannot do this');
      await sql`INSERT INTO records (store, id, data) VALUES (${store}, ${String(rid)}, ${JSON.stringify(b)}::jsonb)
                ON CONFLICT (store, id) DO UPDATE SET data = EXCLUDED.data`;
      return res.json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (store === 'patients' && !['rso', 'admin'].includes(me.role)) return bad(res, 403, 'Your role cannot do this');
      await sql`DELETE FROM records WHERE store = ${store} AND id = ${id}`;
      return res.json({ ok: true });
    }
    if (req.method === 'POST' && action === 'clear') {
      if (!admin) return bad(res, 403, 'Only administrators can restore backups');
      await sql`DELETE FROM records WHERE store = ${store}`;
      return res.json({ ok: true });
    }
    return bad(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return bad(res, 500, 'Server error. Please try again.');
  }
}
