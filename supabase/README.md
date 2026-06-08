# Supabase Setup

## Apply Schema

### Option A: SQL Editor

1. Open the Supabase project.
2. Go to SQL Editor.
3. Open `supabase/schema.sql` from this repo.
4. Paste the full SQL into the editor.
5. Run it once.

The SQL is idempotent for the current phase. It uses `create table if not exists` and `on conflict` for seed rows.

### Option B: Local Script

Add the direct database connection string to `.env.local`:

```env
SUPABASE_DATABASE_URL=
```

Then run:

```powershell
npm run supabase:apply-schema
```

## What It Creates

- Core chat/client/requirement tables
- Dynamic config tables
- Website metadata tables
- Uploaded document metadata tables
- Sync/logging tables
- Service category seed data
- Initial service-specific onboarding fields
- Default model settings

## Required Environment Values

`.env.local` must include:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Do not put real keys in `.env.example`.

## Smoke Checks

After applying the SQL and restarting the dev server:

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/config/service-categories -UseBasicParsing
```

Expected: JSON with seeded service categories.

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/config/onboarding-fields?service=mortgage-automation" -UseBasicParsing
```

Expected: JSON with Mortgage Automation onboarding fields.
