export const PLANS = {
  STARTER: {
    name: "Starter",
    description: "For small teams getting started",
    features: {
      maxTeamMembers: 3,
      maxContacts: 5000,
      automationRules: 5,
      flowsEnabled: false,
      aiEnabled: false,
      // Messages: unlimited on all plans — Meta charges apply directly to the customer
      messagesUnlimited: true,
    },
    pricing: {
      monthly: { amount: 89900, interval: 1, period: "monthly" },
      quarterly: { amount: 249900, interval: 3, period: "monthly" },
      yearly: { amount: 999900, interval: 1, period: "yearly" },
    },
  },
  GROWTH: {
    name: "Growth",
    description: "For growing businesses",
    features: {
      maxTeamMembers: 10,
      maxContacts: 25000,
      automationRules: -1,
      flowsEnabled: true,
      aiEnabled: false,
      messagesUnlimited: true,
    },
    pricing: {
      monthly: { amount: 189900, interval: 1, period: "monthly" },
      quarterly: { amount: 529900, interval: 3, period: "monthly" },
      yearly: { amount: 2119900, interval: 1, period: "yearly" },
    },
  },
  BUSINESS: {
    name: "Scale",
    description: "For scaling businesses",
    features: {
      maxTeamMembers: 25,
      maxContacts: 100000,
      automationRules: -1,
      flowsEnabled: true,
      aiEnabled: true,
      messagesUnlimited: true,
    },
    pricing: {
      monthly: { amount: 599900, interval: 1, period: "monthly" },
      quarterly: { amount: 1669900, interval: 3, period: "monthly" },
      yearly: { amount: 6999900, interval: 1, period: "yearly" },
    },
  },
} as const;

import type { PlanKey, BillingCycle } from "./billing.types";

export interface PricingConfig {
  amount: number;
  razorpayPlanId: string;
  interval: number;
  period: string;
}

// Razorpay plan IDs are resolved lazily (inside this function, on each
// call) rather than baked into the PLANS object above. This module gets
// require()'d while AppModule itself is still loading — before
// @nestjs/config's ConfigModule has parsed .env into process.env — so a
// top-level `process.env.X` read here always sees undefined and would
// permanently bake in "".
const RAZORPAY_ENV_VAR: Record<PlanKey, Record<BillingCycle, string>> = {
  STARTER: {
    monthly: "RAZORPAY_STARTER_MONTHLY_PLAN_ID",
    quarterly: "RAZORPAY_STARTER_QUARTERLY_PLAN_ID",
    yearly: "RAZORPAY_STARTER_YEARLY_PLAN_ID",
  },
  GROWTH: {
    monthly: "RAZORPAY_GROWTH_MONTHLY_PLAN_ID",
    quarterly: "RAZORPAY_GROWTH_QUARTERLY_PLAN_ID",
    yearly: "RAZORPAY_GROWTH_YEARLY_PLAN_ID",
  },
  BUSINESS: {
    monthly: "RAZORPAY_BUSINESS_MONTHLY_PLAN_ID",
    quarterly: "RAZORPAY_BUSINESS_QUARTERLY_PLAN_ID",
    yearly: "RAZORPAY_BUSINESS_YEARLY_PLAN_ID",
  },
};

export function getRazorpayPlanId(
  plan: PlanKey,
  billingCycle: BillingCycle,
): string {
  const envVar = RAZORPAY_ENV_VAR[plan]?.[billingCycle];
  return (envVar && process.env[envVar]) || "";
}

export function getPlanConfig(plan: PlanKey) {
  return PLANS[plan];
}

export function getPlanPricing(
  plan: PlanKey,
  billingCycle: BillingCycle,
): PricingConfig | undefined {
  const base = PLANS[plan]?.pricing[billingCycle];
  if (!base) return undefined;
  return { ...base, razorpayPlanId: getRazorpayPlanId(plan, billingCycle) };
}
