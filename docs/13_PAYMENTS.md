# ResearchAI Payments

ResearchAI uses Clerk for account identity and Stripe Checkout for the first Pro subscription flow. The frontend never receives Stripe secret keys and never renders a custom payment form.

## Required Environment Variables

Set these values in Vercel Project Settings before testing checkout:

- `STRIPE_SECRET_KEY`: Stripe secret key for the account.
- `STRIPE_PRO_PRICE_ID`: Recurring Price ID for the ResearchAI Pro plan.
- `SITE_URL`: Public site URL, for example `https://researchai.app`.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key for frontend authentication.

Do not add secret keys to frontend code, Git, or public documentation. Clerk publishable keys are safe to expose; Clerk secret keys are not.

## Clerk Setup

1. Create a Clerk application.
2. Enable Email authentication.
3. Copy the publishable key.
4. Provide the key to the frontend through the `clerk-publishable-key` meta tag or a small runtime config script that sets `window.RESEARCHAI_CLERK_PUBLISHABLE_KEY`.
5. Do not place `CLERK_SECRET_KEY` in frontend code.

Current frontend auth behavior:

- signed-out users can generate reports under the Free plan limit
- signed-out users are asked to sign in before upgrading
- signed-in users can start Stripe Checkout
- Clerk user id and email are sent to `/api/create-checkout-session`
- Pro is not activated automatically yet

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

## Current Limitation

This sprint includes frontend Clerk authentication, but it does not include server-side Clerk token verification, subscription storage, or Stripe webhooks.

After a successful checkout, ResearchAI shows:

`Payment received. Pro account activation will be completed after account setup.`

This is intentional for the first test launch. Pro status is not activated automatically yet.

## Next Step

The next production milestone should add:

- server-side Clerk token verification
- Stripe webhook handling
- customer and subscription persistence
- subscription status checks in the frontend
- Pro limit enforcement based on server-side subscription state
