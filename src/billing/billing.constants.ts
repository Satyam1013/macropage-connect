import type { Plan } from "./billing.types";

export type PlanFeature =
  | "automation"
  | "flowBuilder"
  | "aiChatbot"
  | "apiAccess"
  | "advancedAnalytics"
  | "teamManagement";

// Which plans can access each feature
export const FEATURE_PLANS: Record<PlanFeature, Plan[]> = {
  automation:        ["TRIAL", "GROWTH", "BUSINESS", "ENTERPRISE"],
  flowBuilder:       ["TRIAL", "GROWTH", "BUSINESS", "ENTERPRISE"],
  aiChatbot:         ["TRIAL", "GROWTH", "BUSINESS", "ENTERPRISE"],
  apiAccess:         ["TRIAL", "GROWTH", "BUSINESS", "ENTERPRISE"],
  advancedAnalytics: ["TRIAL", "GROWTH", "BUSINESS", "ENTERPRISE"],
  teamManagement:    ["TRIAL", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"],
};

// Human-readable upgrade message per feature
export const FEATURE_UPGRADE_MESSAGE: Record<PlanFeature, string> = {
  automation:        "Automation rules require Growth plan or above",
  flowBuilder:       "Flow Builder requires Growth plan or above",
  aiChatbot:         "AI Chatbot requires Growth plan or above",
  apiAccess:         "API access requires Growth plan or above",
  advancedAnalytics: "Advanced analytics require Growth plan or above",
  teamManagement:    "Team management is available on all plans",
};

export const PLAN_LIMITS = {
  TRIAL: {
    teamMembers: 10,
    contacts: 25000,
    whatsappNumbers: 2,
    aiSessions: 500,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  STARTER: {
    teamMembers: 3,
    contacts: 5000,
    whatsappNumbers: 1,
    aiSessions: 0,
    flowBuilder: false,
    aiChatbot: false,
    apiAccess: false,
  },
  GROWTH: {
    teamMembers: 10,
    contacts: 25000,
    whatsappNumbers: 2,
    aiSessions: 500,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  BUSINESS: {
    teamMembers: 25,
    contacts: 100000,
    whatsappNumbers: 5,
    aiSessions: 5000,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    teamMembers: -1,
    contacts: -1,
    whatsappNumbers: -1,
    aiSessions: -1,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
};

export const PLAN_PRICING = [
  {
    id: "STARTER",
    name: "Starter",
    price: 1999,
    currency: "INR",
    period: "month",
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 4999,
    currency: "INR",
    period: "month",
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 9999,
    currency: "INR",
    period: "month",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 0,
    currency: "INR",
    period: "month",
    custom: true,
  },
];
