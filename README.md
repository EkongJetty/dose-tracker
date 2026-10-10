# Dose Tracker: deploy on Vercel with a database

## Files
- `index.html`  the app
- `api/auth.js` sign up, sign in, sign out, change password
- `api/db.js`   patients, exams, settings, account admin (needs sign-in)
- `api/_lib.js` database connection, password hashing, sessions
- `package.json`

Tables are created automatically on the first request. No SQL to run.
The app starts empty. There is no sample or dummy data.

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

## Importing your own data
Patients, Exams and Settings all have an **Import data** button. Radiographers, radiologists, radiation safety officers and administrators can use it
(the same roles the server lets write patient and exam records). Medical physicists can view data but not import.

1. Click **Import data** > **Download template (.xlsx)**.
2. Fill the **Patients** sheet and the **Exams** sheet. The **Exam codes** sheet lists the exam names and the dose value each one needs.
3. Upload the file. The app shows how many patients and exams are new and lists any rows with problems.
4. Tick the confirmation that patients have been told their dose details are recorded, then click **Import**.

Rules:
- Required on Patients: Patient ID, Name, Date of birth, Sex. Required on Exams: Patient ID, Exam, Date, Dose value.
- Dates as `yyyy-mm-dd` (dd/mm/yyyy also works). `.xlsx`, `.xls` and `.csv` are accepted. A CSV can hold patients or exams.
- Rows with problems are skipped and listed. Valid rows are still imported.
- Patients that already exist are left unchanged. Exams already saved (same patient, exam, date and dose) are skipped, so the same file can be uploaded twice safely.
- Each exam's patient must be in the same file or already in the system.
- Up to 5,000 rows and 15 MB per file. Larger datasets: split the file.
- Imported exams go through the same dose checks and flags as exams logged by hand.
- If your database still holds sample patients from an earlier version, they are removed automatically the next time a radiation safety officer or administrator signs in. Settings also has a **Remove sample patients** button until they are gone.

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
- Outlier chart: plots only your own exams. The size-adjusted line is a model, not a published standard.
- Not yet done: DICOM RDSR import is not built.
