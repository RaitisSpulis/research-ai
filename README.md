# ResearchAI

ResearchAI is an AI SaaS research workspace that turns a user question into a structured professional report with executive summary, findings, analysis, risks, recommendations, source guidance, saved history, exports, authentication, subscriptions, and server-backed usage limits.

This repository is portfolio-safe. It demonstrates product thinking, frontend polish, backend integration, billing infrastructure, database-backed persistence, and production hardening without claiming verified customers, revenue, or market traction.

## Features

- Professional report generation flow
- Dynamic report engine with topic and intent adaptation
- Saved reports, pinned reports, history, and local cache fallback
- Copy, Markdown, Word-compatible, and print/PDF export flows
- Clerk sign up, sign in, sign out, and account state
- Free usage limits and Pro unlimited reports
- Stripe Checkout for Pro subscriptions
- Stripe Billing Portal for subscription management
- Stripe webhook subscription sync
- Automatic server-side billing sync after Billing Portal return
- Supabase-backed users, reports, saved reports, and monthly usage
- Production security headers and Content Security Policy

## Technology Stack

- HTML, CSS, JavaScript
- Vercel static hosting and serverless functions
- Clerk authentication
- Stripe Checkout, Billing Portal, and webhooks
- Supabase Postgres via server-side REST
- Gemini API provider layer

## Architecture

```txt
Browser UI
  -> Vercel API routes
  -> Clerk token verification
  -> Gemini provider
  -> Supabase data layer
  -> Stripe Checkout / Billing Portal / Webhooks
```

The browser never receives server-side secrets. Protected routes verify Clerk bearer tokens server-side. Billing state is synchronized through verified Stripe webhooks and an authenticated `/api/sync-billing-status` endpoint after Billing Portal return.

## Screenshots

Add screenshots before publishing:

- Dashboard / first screen
- Generated report view
- Saved reports workspace
- Billing settings
- Mobile layout

## Local Setup

This project is a framework-free static frontend with Vercel-style API routes.

1. Install dependencies if a package manager is added later.
2. Set environment variables in your deployment environment.
3. Run or deploy with Vercel-compatible serverless functions.
4. Open `index.html` for static UI inspection.

## Environment Variables

Use names only. Never commit values.

```txt
CLERK_PUBLISHABLE_KEY
VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_JWT_ISSUER
STRIPE_SECRET_KEY
STRIPE_PRO_PRICE_ID
STRIPE_WEBHOOK_SECRET
SITE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GEMINI_MODEL
```

## Security Notes

- Stripe webhook signatures are verified using the raw request body.
- Supabase service role access is server-side only.
- Clerk session tokens are verified before protected API work.
- User report ownership is scoped by authenticated Clerk user id.
- Report rendering escapes user-controlled strings.
- CSP and security headers are configured for production deployment.

## Deployment Notes

- Configure all environment variables in Vercel.
- Configure Stripe webhook delivery for subscription events.
- Enable and configure Stripe Billing Portal.
- Run the Supabase schema and RLS migrations from `docs/14_DATABASE.md`.
- Verify Clerk publishable and secret keys are set for the correct environment.

## Live Demo

Placeholder: `https://researchai.app`

## Case Study

See `case-study.html` for a portfolio-friendly product and engineering overview.
