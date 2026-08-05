import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlanDocument = HydratedDocument<Plan>;

// Canonical plan catalog — source of truth for both the public pricing
// page (GET /billing/plans) and the platform-admin "Edit plan" screen.
// Bootstrapped once from billing.constants.ts's PLAN_PRICING via
// scripts/seed-plans.ts; every admin edit after that writes straight here,
// so there's no separate override layer that can fall out of sync with
// what's actually charged.
@Schema({ timestamps: true, collection: "plans" })
export class Plan {
  @Prop({ required: true, unique: true, immutable: true })
  planId!: string;

  @Prop({ required: true, type: Object })
  plan!: Record<string, unknown>;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
