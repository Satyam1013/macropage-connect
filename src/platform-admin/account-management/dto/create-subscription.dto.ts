import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export const ADMIN_PLAN_IDS = [
  "STARTER",
  "GROWTH",
  "BUSINESS",
  "ENTERPRISE",
] as const;
export type AdminPlanId = (typeof ADMIN_PLAN_IDS)[number];

export const ADMIN_BILLING_CYCLES = ["monthly", "quarterly", "yearly"] as const;
export type AdminBillingCycle = (typeof ADMIN_BILLING_CYCLES)[number];

export class CreateSubscriptionDto {
  @IsIn(ADMIN_PLAN_IDS)
  planId!: AdminPlanId;

  @IsIn(ADMIN_BILLING_CYCLES)
  billingCycle!: AdminBillingCycle;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  // INR (rupees). Defaults to the plan's price for the cycle, or 0 when
  // paymentMode is "complimentary".
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountPaid?: number;

  @IsOptional()
  @IsIn(["manual", "complimentary"])
  paymentMode?: "manual" | "complimentary";

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
