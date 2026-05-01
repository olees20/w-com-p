import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20"
});

export const STRIPE_PRICE_ID_STARTER = process.env.STRIPE_PRICE_ID_STARTER;
