export type Plan = "TRIAL" | "STARTER" | "GROWTH" | "BUSINESS" | "ENTERPRISE";

export type SubStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "TRIALING"
  | "EXPIRED";

export type PlanFeature =
  | "automation"
  | "flowBuilder"
  | "aiChatbot"
  | "apiAccess"
  | "advancedAnalytics"
  | "teamManagement";

export type PlanKey = "STARTER" | "GROWTH" | "BUSINESS";

export type BillingCycle = "monthly" | "quarterly" | "yearly";
