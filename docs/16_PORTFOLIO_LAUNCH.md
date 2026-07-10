# Portfolio Launch Guide

ResearchAI can be shared as a professional portfolio project for freelance clients, hiring managers, and product collaborators.

## Screenshots To Capture

- First screen / dashboard
- Prompt input workflow
- Generated report document
- Report history and pinned reports
- Pricing section
- Authentication signed-in state
- Billing settings with Pro status
- Mobile layout

Avoid screenshots that reveal private user ids, Stripe customer ids, subscription ids, Supabase project ids, API logs, webhook logs, or admin dashboards.

## Recommended Portfolio Description

ResearchAI is an AI SaaS research workspace that turns a user question into a structured professional report. The project demonstrates end-to-end SaaS engineering: polished frontend UX, AI provider integration, authentication, subscriptions, billing portal management, Stripe webhooks, Supabase persistence, server-side usage limits, exports, and production security hardening.

## Skills Demonstrated

- Product strategy and UX writing
- Responsive frontend implementation
- Professional document/report interface design
- Vanilla JavaScript application architecture
- Vercel serverless API routes
- Clerk authentication
- Stripe Checkout, Billing Portal, and webhook sync
- Supabase schema design and server-side persistence
- Secure environment variable handling
- CSP and production security headers
- QA, debugging, and production readiness workflows

## Safe Information To Publish

- Public feature descriptions
- Architecture diagrams without secrets
- Screenshots of normal user-facing UI
- Technology stack
- General engineering challenges solved
- Case study page
- README
- Public demo URL

## Information That Must Remain Private

- API keys and secret keys
- Stripe customer ids and subscription ids
- Clerk user ids and secret keys
- Supabase service role key and project secrets
- Webhook signing secrets
- Private Vercel environment settings
- Real user data, prompts, or generated reports unless explicitly approved
- Internal logs containing identifiers

## Suggested Freelance Pitch

I build production-minded AI SaaS products: polished interfaces, authentication, subscriptions, database-backed workspaces, AI provider integrations, exports, billing portals, and secure deployment flows. ResearchAI demonstrates how I approach a project from product concept through launch readiness, including trust-focused UX, server-side limits, Stripe billing, Supabase persistence, and production QA.

## Launch Checklist

- Replace screenshot placeholders with real product screenshots.
- Confirm `case-study.html` works on desktop and mobile.
- Confirm README contains no secrets.
- Confirm footer links work.
- Confirm demo account or public beta flow is ready before sharing.
- Confirm billing and auth flows use test or production environments intentionally.
