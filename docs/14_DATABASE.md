# ResearchAI Database Foundation

Sprint 14 introduces Supabase as the server-side data foundation while keeping Clerk as the authentication provider.

## Environment Variables

Set these in Vercel Project Settings:

- `SUPABASE_URL`: Supabase project URL, for example `https://project-ref.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key. Keep this server-side only.
- `CLERK_PUBLISHABLE_KEY`: Clerk frontend publishable key.
- `CLERK_SECRET_KEY`: Clerk backend secret key for payment/webhook metadata updates.
- `CLERK_JWT_ISSUER`: Optional explicit Clerk JWT issuer. If omitted, ResearchAI derives it from `CLERK_PUBLISHABLE_KEY`.
- `GEMINI_API_KEY`: Gemini provider key.
- `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`: payment configuration.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `GEMINI_API_KEY`, or Stripe secret keys in frontend code.

## Schema

Run this SQL in Supabase SQL Editor.

```sql
create table if not exists public.users (
  clerk_user_id text primary key,
  email text,
  plan text not null default 'free',
  subscription_status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id text primary key,
  user_id text not null references public.users(clerk_user_id) on delete cascade,
  title text not null,
  prompt text not null,
  report_type text not null default 'general_research',
  pinned boolean not null default false,
  report_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, pinned desc, created_at desc)
  where deleted_at is null;

create table if not exists public.usage (
  user_id text not null references public.users(clerk_user_id) on delete cascade,
  month text not null,
  count integer not null default 0,
  monthly_limit integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(clerk_user_id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_reports (
  user_id text not null references public.users(clerk_user_id) on delete cascade,
  report_id text not null references public.reports(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (user_id, report_id)
);
```

If the Sprint 14 schema already exists, run this upgrade migration:

```sql
alter table public.users
  add column if not exists subscription_status text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;
```

## Current Flow

1. The frontend gets a Clerk session token.
2. `/api/generate` verifies the Clerk token server-side.
3. The API upserts the Clerk user into `users`.
4. The API checks the monthly `usage` row before live Gemini generation.
5. After successful live generation, the API increments `usage`.
6. The frontend parses the report into the existing ResearchAI report structure.
7. `/api/reports` saves the structured report into `reports` and `saved_reports`.
8. Report history, pinned state, delete actions, and usage refresh from Supabase for signed-in users.
9. `localStorage` remains only as a browser cache and offline fallback.

Subscription webhooks keep `users.plan`, `users.subscription_status`,
`users.stripe_customer_id`, and `users.stripe_subscription_id` synchronized with
Stripe and Clerk metadata.

If live Gemini fails and the browser creates a local fallback report, `/api/reports` enforces and increments usage before saving the fallback report.

## API Endpoints

- `GET /api/reports`: list authenticated user's saved reports and current usage.
- `POST /api/reports`: save a report. With `countUsage: true`, enforce and increment server-side usage.
- `PATCH /api/reports`: update pinned state.
- `DELETE /api/reports`: soft-delete a report.
- `GET /api/usage`: read authenticated user's monthly usage.
- `POST /api/generate`: verify Clerk, enforce usage, call Gemini, increment usage after success.

## Local Development

1. Create a Supabase project.
2. Run the schema SQL above.
3. Add `.env.local` or local Vercel env values:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_JWT_ISSUER=
GEMINI_API_KEY=
```

4. Run the project locally through the same Vercel function environment used for API testing.
5. Sign in with Clerk before generating reports.

Developer Mode can still bypass browser display limits locally, but production report generation is authenticated and database-backed.

## Production Deployment

1. Add all required environment variables in Vercel.
2. Deploy.
3. Verify `/api/usage` returns the signed-in user's usage.
4. Generate a report.
5. Confirm:
   - `users` contains the Clerk user id.
   - `usage` increments for the current UTC month.
   - `reports` stores the structured report JSON.
   - `saved_reports` contains the user/report mapping.
   - Pinned and deleted reports persist across browsers.

## Notes

This sprint uses Supabase REST with the service role key inside Vercel Functions only. Row Level Security can be enabled later for direct client access, but the current beta architecture intentionally keeps database writes server-side.

For higher-concurrency launches, replace the read-then-upsert usage increment with a PostgreSQL RPC that atomically checks and increments usage in a single transaction.
