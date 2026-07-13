import { IsIn } from "class-validator";
import type { BillingCycle, PlanKey } from "../billing.types";

export class CreateSubscriptionDto {
  @IsIn(["STARTER", "GROWTH", "BUSINESS"])
  plan!: PlanKey;

  @IsIn(["monthly", "quarterly", "yearly"])
  billingCycle!: BillingCycle;
}
