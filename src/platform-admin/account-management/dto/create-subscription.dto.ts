import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export const ADMIN_PLAN_IDS = [
  "STARTER",
  "GROWTH",
  "BUSINESS",
  "ENTERPRISE",
] as const;
export type AdminPlanId = (typeof ADMIN_PLAN_IDS)[number];

export const ADMIN_BILLING_CYCLES = ["monthly", "quarterly", "yearly"] as const;
export type AdminBillingCycle = (typeof ADMIN_BILLING_CYCLES)[number];

const trimmed = (fn: (s: string) => string) =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? fn(value.trim()) : value,
  );

export class CreateSubscriptionDto {
  // Matched case-insensitively against the GET /billing/plans catalog (an
  // unknown plan is a 404 from the service, not a validation error).
  @trimmed((s) => s.toUpperCase())
  @IsString({ message: "planId is required" })
  @IsNotEmpty({ message: "planId is required" })
  planId!: string;

  @trimmed((s) => s.toLowerCase())
  @IsIn(ADMIN_BILLING_CYCLES, {
    message: "billingCycle must be monthly, quarterly or yearly",
  })
  billingCycle!: AdminBillingCycle;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  // INR (rupees). Defaults to the plan's GET /billing/plans price for the
  // cycle, or 0 when paymentMode is "complimentary" / the plan is custom.
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
