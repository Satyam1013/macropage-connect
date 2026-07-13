import { SetMetadata } from "@nestjs/common";
import type { PlanFeature } from "../../billing/billing.types";

export const PLAN_FEATURE_KEY = "planFeature";
export const RequirePlan = (feature: PlanFeature) =>
  SetMetadata(PLAN_FEATURE_KEY, feature);
