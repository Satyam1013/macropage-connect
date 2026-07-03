import { IsIn } from "class-validator";
import type { BillingCycle, PlanKey } from "../plans.config";

export class CreateSubscriptionDto {
  @IsIn(["STARTER", "GROWTH", "BUSINESS"])
  plan!: PlanKey;

  @IsIn(["monthly", "quarterly", "yearly"])
  billingCycle!: BillingCycle;
}
