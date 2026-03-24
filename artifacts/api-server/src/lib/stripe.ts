import Stripe from "stripe";

// Uses STRIPE_SECRET_KEY env var directly.
// Set this secret when ready to enable Stripe payments.
// No Replit connector dependency — safe to deploy without Stripe.
export async function getUncachableStripeClient(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-08-27.basil" as any });
}

export async function getStripePublishableKey(): Promise<string | null> {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}
