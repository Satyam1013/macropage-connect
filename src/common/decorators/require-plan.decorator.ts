import { SetMetadata } from "@nestjs/common";
import type { PlanFeature } from "../../billing/billing.constants";

export const PLAN_FEATURE_KEY = "planFeature";
export const RequirePlan = (feature: PlanFeature) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
