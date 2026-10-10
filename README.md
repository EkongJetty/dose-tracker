# Dose Tracker: deploy on Vercel with a database

## Files
- `index.html`  the app (same design, now talks to the server)
- `api/auth.js` sign up, sign in, sign out, change password
- `api/db.js`   patients, exams, settings, account admin (needs sign-in)
- `api/_lib.js` database connection, password hashing, sessions
- `package.json`

Tables are created automatically on the first request. No SQL to run.

## Steps
1. Put this folder in a GitHub repository (or use the Vercel CLI: `npm i -g vercel`, then `vercel` in this folder).
2. On vercel.com: Add New > Project > import the repository > Deploy.
3. In the project: Storage (or Marketplace) > Neon Postgres > Create > connect it to this project.
   Vercel adds `DATABASE_URL` for you.
4. Settings > Environment Variables > add `SESSION_SECRET` with a long random value.
   Make one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. Deployments > Redeploy (so the new variables are picked up).
6. Open your site. The first account you create becomes the Administrator.

## Run locally
`npm i -g vercel`, then `vercel link`, `vercel env pull .env.local`, `vercel dev`.

## Reports
Reports page > pick a report > Download Excel (.xlsx), Export CSV, or Print report.
All signed-in clinical roles can print and download. The Excel file has a header block
(facility, period, who generated it), the summary figures, a filterable table and a sign-off line.
`xlsx.full.min.js` is bundled in this folder (no outside CDN needed).

## Standards used for dose checks
- Reference levels (DRL): group benchmark, ICRP Publication 135. The app compares the MEDIAN dose of adult exams
  (at least 10) with the DRL. It never judges one exam against a DRL. Starting DRL values are placeholders:
  replace them with your national or local values, confirmed by your medical physicist.
- Alert values: one per protocol, set by the facility (NEMA XR 25 CT Dose Check, AAPM). A single exam above
  its alert value is flagged for review. No alert is active until a value is entered on Reference levels.
- Cumulative review level: a local trigger you can adjust. It is not a dose limit.
- Effective dose: dose index x fixed conversion factor. An estimate for comparing groups.
- Not yet done: patient weight/size is not recorded, DICOM RDSR import is not built.
