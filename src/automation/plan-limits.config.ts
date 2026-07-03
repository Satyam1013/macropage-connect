export const AUTOMATION_PLAN_LIMITS = {
  TRIAL: {
    rulesEnabled: true,
    maxCustomRules: -1,
    flowsEnabled: true,
    aiEnabled: false,
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
  EXPIRED: {
    rulesEnabled: false,
    maxCustomRules: 0,
    flowsEnabled: false,
    aiEnabled: false,
  },
} as const;

export type PlanKey = keyof typeof AUTOMATION_PLAN_LIMITS;

export function getPlanLimits(tenant: {
  plan?: string;
  trialEndsAt?: Date | string | null;
}) {
  const plan = tenant?.plan ?? "STARTER";

  if (plan === "TRIAL" || plan === "FREE") {
    const trialEndsAt = tenant.trialEndsAt
      ? new Date(tenant.trialEndsAt)
      : null;
    const trialExpired = !trialEndsAt || new Date() > trialEndsAt;
    if (trialExpired) return AUTOMATION_PLAN_LIMITS.EXPIRED;
    return AUTOMATION_PLAN_LIMITS.TRIAL;
  }

  return (
    AUTOMATION_PLAN_LIMITS[plan as PlanKey] ?? AUTOMATION_PLAN_LIMITS.STARTER
  );
}
