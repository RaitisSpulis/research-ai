# ResearchAI Payments

ResearchAI uses Clerk for account identity and Stripe Checkout for the first Pro subscription flow. The frontend never receives Stripe secret keys and never renders a custom payment form.

## Required Environment Variables

Set these values in Vercel Project Settings before testing checkout:

- `STRIPE_SECRET_KEY`: Stripe secret key for the account.
- `STRIPE_PRO_PRICE_ID`: Recurring Price ID for the ResearchAI Pro plan.
- `SITE_URL`: Public site URL, for example `https://researchai.app`.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key for frontend authentication. Preferred name for Vercel production.
- `VITE_CLERK_PUBLISHABLE_KEY`: Optional fallback name if you already use Vite-style env naming.
- `CLERK_SECRET_KEY`: Clerk backend secret key for webhook activation.
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret.

Do not add secret keys to frontend code, Git, or public documentation. Clerk publishable keys are safe to expose; Clerk secret keys are not.

## Clerk Setup

1. Create a Clerk application.
2. Enable Email authentication.
3. Copy the publishable key.
4. In Vercel, set `CLERK_PUBLISHABLE_KEY` for Production, Preview, and Development as needed.
5. ResearchAI exposes this public value to the browser through `GET /api/public-config`.
6. The frontend loads Clerk from the Clerk Frontend API domain derived from the publishable key.
7. Do not place `CLERK_SECRET_KEY` in frontend code.

Current frontend auth behavior:

- signed-out users can generate reports under the Free plan limit
- signed-out users are asked to sign in before upgrading
- signed-in users can start Stripe Checkout
- Clerk user id and email are sent to `/api/create-checkout-session`
- Pro is activated after Stripe sends a verified `checkout.session.completed` webhook

## Creating the Stripe Product and Price

1. Open the Stripe Dashboard.
2. Create a Product named `ResearchAI Pro`.
3. Add a recurring monthly Price for the Pro plan.
4. Copy the Price ID, which usually starts with `price_`.
5. Add that value as `STRIPE_PRO_PRICE_ID` in Vercel.

## Checkout Flow

The frontend calls:

`POST /api/create-checkout-session`

with:

```json
{
  "userId": "clerk_user_id",
  "email": "user@example.com"
}
```

The Vercel function creates a Stripe Checkout Session with:

- `mode: subscription`
- one line item using `STRIPE_PRO_PRICE_ID`
- success redirect to `SITE_URL + "?checkout=success"`
- cancellation redirect to `SITE_URL + "?checkout=cancelled"`
- `client_reference_id` set to the Clerk user id
- metadata containing the Clerk user id and email

The endpoint returns:

```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/..."
}
```

The browser redirects the user to the returned Stripe Checkout URL.

## Stripe Webhook Setup

Create a Stripe webhook endpoint pointing to:

`https://research-ai-tau-steel.vercel.app/api/stripe-webhook`

Subscribe to:

- `checkout.session.completed`

After creating the endpoint, copy the signing secret into:

`STRIPE_WEBHOOK_SECRET`

The webhook:

1. Verifies the Stripe signature.
2. Reads the Clerk user id from `client_reference_id` or session metadata.
3. Marks the Clerk user as Pro in public and private metadata.

Use Stripe Dashboard -> Developers -> Events -> `checkout.session.completed` to confirm delivery succeeded. If delivery fails, inspect the Vercel function logs for `[Stripe webhook]` messages.

The checkout session stores:

- `client_reference_id`: Clerk user id
- `metadata.clerkUserId`: Clerk user id
- `metadata.email`: Clerk email, when available

## Current Limitation

This sprint includes frontend Clerk authentication and webhook-based Pro activation. It does not yet include server-side Clerk token verification for every API request or a separate subscription database.

After a successful checkout, ResearchAI shows:

`Payment received. Pro account activation will be completed after account setup.`

The user becomes Pro after Stripe delivers the verified webhook and Clerk metadata refreshes.

## Next Step

The next production milestone should add:

- server-side Clerk token verification for protected API routes
- customer and subscription persistence
- subscription status checks in the frontend
- Pro limit enforcement based on server-side subscription state
