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
      monthly: {
        amount: 89900,
        razorpayPlanId: process.env.RAZORPAY_STARTER_MONTHLY_PLAN_ID ?? "",
        interval: 1,
        period: "monthly",
      },
      quarterly: {
        amount: 249900,
        razorpayPlanId: process.env.RAZORPAY_STARTER_QUARTERLY_PLAN_ID ?? "",
        interval: 3,
        period: "monthly",
      },
      yearly: {
        amount: 999900,
        razorpayPlanId: process.env.RAZORPAY_STARTER_YEARLY_PLAN_ID ?? "",
        interval: 1,
        period: "yearly",
      },
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
      monthly: {
        amount: 189900,
        razorpayPlanId: process.env.RAZORPAY_GROWTH_MONTHLY_PLAN_ID ?? "",
        interval: 1,
        period: "monthly",
      },
      quarterly: {
        amount: 529900,
        razorpayPlanId: process.env.RAZORPAY_GROWTH_QUARTERLY_PLAN_ID ?? "",
        interval: 3,
        period: "monthly",
      },
      yearly: {
        amount: 2119900,
        razorpayPlanId: process.env.RAZORPAY_GROWTH_YEARLY_PLAN_ID ?? "",
        interval: 1,
        period: "yearly",
      },
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
      monthly: {
        amount: 599900,
        razorpayPlanId: process.env.RAZORPAY_BUSINESS_MONTHLY_PLAN_ID ?? "",
        interval: 1,
        period: "monthly",
      },
      quarterly: {
        amount: 1669900,
        razorpayPlanId: process.env.RAZORPAY_BUSINESS_QUARTERLY_PLAN_ID ?? "",
        interval: 3,
        period: "monthly",
      },
      yearly: {
        amount: 6999900,
        razorpayPlanId: process.env.RAZORPAY_BUSINESS_YEARLY_PLAN_ID ?? "",
        interval: 1,
        period: "yearly",
      },
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

export function getPlanConfig(plan: PlanKey) {
  return PLANS[plan];
}

export function getPlanPricing(
  plan: PlanKey,
  billingCycle: BillingCycle,
): PricingConfig | undefined {
  return PLANS[plan]?.pricing[billingCycle];
}
