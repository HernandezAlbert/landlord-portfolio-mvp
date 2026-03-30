# Landlord Portfolio (MVP)

Next.js (App Router) + TypeScript + Postgres + Prisma.

## 1) Setup (Local)

### Install
```bash
npm i
```

### Create .env
```bash
cp .env.example .env
```

Fill:
- DATABASE_URL
- AUTH_SECRET (32+ chars random)
- ADMIN_EMAIL / ADMIN_PASSWORD

### Migrate + Seed
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run seed
```

### Run
```bash
npm run dev
```

Open:
- http://localhost:3000/login

Login with:
- ADMIN_EMAIL / ADMIN_PASSWORD

## 2) Notes
- Amounts are stored in **pence** (e.g. 120000 = £1200.00)
- RAG thresholds:
  - RED <= 30 days
  - AMBER <= 60 days
  - GREEN > 60 days
- Section 8 eligibility heuristic (MVP):
  - arrears >= 2 * monthly rent

## 3) Deploy (Vercel + Neon/Supabase)
1. Create managed Postgres and copy DATABASE_URL.
2. Add env vars in Vercel: DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD.
3. Run migrations against production DB (recommended from your machine):
```bash
DATABASE_URL="..." npx prisma migrate deploy
DATABASE_URL="..." npm run seed
```
4. Deploy.



## 2) Admin UI (Create/Edit/Delete)
Use the in-app admin pages to manage:
- Properties (including compliance + inspections)
- Tenants
- Tenancies (attach tenants)
- Payments (rent log)
- Notices

## 3) Rent schedule generator
On a tenancy detail page, use **Generate rent due rows** to create missing monthly due rows (up to 36 months ahead).

## 4) Email + Reminders (Resend + Vercel Cron)

### Email provider
This project uses the Resend HTTP API.

Add to `.env` / Vercel env vars:
- RESEND_API_KEY
- EMAIL_FROM
- EMAIL_TO (your own email, for digests)
- APP_BASE_URL (e.g. https://your-app.vercel.app)

### Send a test email
Open `/settings` and click **Send test email**.

### Cron reminders
Vercel Cron Jobs can call:
- GET `/api/cron/daily` (daily digest)
- GET `/api/cron/weekly` (weekly digest)

To secure cron invocations, add `CRON_SECRET` to Vercel env vars.
Vercel will automatically send `Authorization: Bearer <CRON_SECRET>` for cron invocations. citeturn1search1

`vercel.json` already includes a daily + weekly schedule (UTC).

### Local testing of cron
You can call endpoints locally using curl, passing the header:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/daily
```

## 5) Prisma migrations
This version adds EmailLog + ReminderConfig models. Run:
```bash
npx prisma migrate dev --name reminders
```
in dev, and in production:
```bash
npx prisma migrate deploy
```


## 6) Applicants + Referencing workflow
This version adds an applicants pipeline so you can:
- create applicants against a property
- track requested proofs and referencing checks
- auto-score applicants and suggest ACCEPT / GUARANTOR / REVIEW / DECLINE

After pulling this version, run a new Prisma migration and generate the client:
```bash
npx prisma migrate dev --name applicants_referencing
npx prisma generate
```

New routes:
- `/applicants`
- `/applicants/[id]`
