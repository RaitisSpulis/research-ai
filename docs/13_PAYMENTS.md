# ResearchAI Payments

ResearchAI uses Stripe Checkout for the first Pro subscription flow. The frontend never receives Stripe secret keys and never renders a custom payment form.

## Required Environment Variables

Set these values in Vercel Project Settings before testing checkout:

- `STRIPE_SECRET_KEY`: Stripe secret key for the account.
- `STRIPE_PRO_PRICE_ID`: Recurring Price ID for the ResearchAI Pro plan.
- `SITE_URL`: Public site URL, for example `https://researchai.app`.

Do not add secret keys to frontend code, Git, or public documentation.

## Creating the Stripe Product and Price

1. Open the Stripe Dashboard.
2. Create a Product named `ResearchAI Pro`.
3. Add a recurring monthly Price for the Pro plan.
4. Copy the Price ID, which usually starts with `price_`.
5. Add that value as `STRIPE_PRO_PRICE_ID` in Vercel.

## Checkout Flow

The frontend calls:

`POST /api/create-checkout-session`

The Vercel function creates a Stripe Checkout Session with:

- `mode: subscription`
- one line item using `STRIPE_PRO_PRICE_ID`
- success redirect to `SITE_URL + "?checkout=success"`
- cancellation redirect to `SITE_URL + "?checkout=cancelled"`

The endpoint returns:

```json
{
  "ok": true,
  "url": "https://checkout.stripe.com/..."
}
```

The browser redirects the user to the returned Stripe Checkout URL.

## Current Limitation

This sprint does not include authentication, customer accounts, subscription storage, or Stripe webhooks.

After a successful checkout, ResearchAI shows:

`Payment received. Pro account activation will be completed after account setup.`

This is intentional for the first test launch. Pro status is not activated automatically yet.

## Next Step

The next production milestone should add:

- authentication
- Stripe webhook handling
- customer and subscription persistence
- subscription status checks in the frontend
- Pro limit enforcement based on server-side subscription state
