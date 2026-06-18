export const AUTOMATION_PLAN_LIMITS = {
  TRIAL: {
    rulesEnabled: true,
    maxCustomRules: -1,
    flowsEnabled: true,
    aiEnabled: true,
  },
  STARTER: {
    rulesEnabled: true,
    maxCustomRules: 5,
    flowsEnabled: false,
    aiEnabled: false,
  },
  GROWTH: {
    rulesEnabled: true,
    maxCustomRules: -1,
    flowsEnabled: true,
    aiEnabled: false,
  },
  BUSINESS: {
    rulesEnabled: true,
    maxCustomRules: -1,
    flowsEnabled: true,
    aiEnabled: true,
  },
  ENTERPRISE: {
    rulesEnabled: true,
    maxCustomRules: -1,
    flowsEnabled: true,
    aiEnabled: true,
  },
} as const;

export type PlanKey = keyof typeof AUTOMATION_PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return (
    AUTOMATION_PLAN_LIMITS[plan as PlanKey] ?? AUTOMATION_PLAN_LIMITS.STARTER
  );
}
