# Billing Portal

ResearchAI uses Stripe Billing Portal so Pro users can manage their own subscription without contacting support.

## Required Environment Variables

Set these in Vercel:

```txt
STRIPE_SECRET_KEY=<your-stripe-secret-key>
SITE_URL=https://researchai.app
CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not expose `STRIPE_SECRET_KEY`, `CLERK_SECRET_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## Stripe Portal Configuration

In Stripe Dashboard:

1. Open **Settings -> Billing -> Customer Portal**.
2. Enable the customer portal.
3. Allow customers to:
   - cancel subscriptions
   - update payment methods
   - view invoices
   - view billing history
4. Save the portal configuration.

ResearchAI creates portal sessions server-side through:

```txt
POST /api/create-billing-portal-session
```

The endpoint verifies the Clerk session, looks up the Stripe customer id from Supabase first, falls back to Clerk metadata, and then creates a Stripe Billing Portal session.

## Current Flow

1. A Pro user opens Settings.
2. ResearchAI refreshes billing status through `/api/usage`.
3. The user clicks **Manage Subscription**.
4. The frontend sends an authenticated request to `/api/create-billing-portal-session`.
5. The server verifies the Clerk token.
6. The server reads `stripe_customer_id` from Supabase `public.users`.
7. If Supabase does not have the customer id, the server checks Clerk private/public metadata.
8. The server creates a Stripe Billing Portal session.
9. The browser redirects to Stripe.
10. Stripe redirects back to `SITE_URL?billing=returned`.
11. The frontend reloads the Clerk user and refreshes Supabase usage/billing state.

If a user cancels at period end, Stripe sends `cancel_at_period_end=true` and
`current_period_end` on subscription update events. ResearchAI stores those
fields in Supabase and Clerk metadata, keeps Pro access active, and shows the
subscription end date in Settings. Pro access is removed only after Stripe sends
the final canceled/deleted subscription event.

## Subscription Sync

Plan changes, cancellations, and failed payments are still synchronized by the Stripe webhook:

```txt
POST /api/stripe-webhook
```

The webhook remains the source of truth for changing Clerk metadata and Supabase `users.plan`.

## Testing Guide

1. Sign in with a Clerk test user.
2. Upgrade through Stripe Checkout.
3. Confirm the webhook marks the user Pro in Clerk and Supabase.
4. Open Settings.
5. Confirm the Billing section shows:
   - Current Plan: Pro
   - Subscription Status: Active or Trialing
   - Manage Subscription
6. Click Manage Subscription.
7. Confirm Stripe Billing Portal opens.
8. Update payment method, view invoices, or cancel subscription in Stripe.
9. Return to ResearchAI.
10. Confirm Clerk and Supabase status refresh after webhook delivery.

Free users should see **Current Plan: Free** and **Upgrade to Pro**, and they should never receive a Billing Portal URL.
