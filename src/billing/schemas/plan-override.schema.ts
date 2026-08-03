import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PlanOverrideDocument = HydratedDocument<PlanOverride>;

/**
 * Admin-owned pricing edits (macropage-admin's PlanOverride collection,
 * same database). Read-only here — merged onto the static PLAN_PRICING
 * catalog so admin edits reach the public pricing page without a deploy.
 */
@Schema({ timestamps: true, collection: "adminplanoverrides" })
export class PlanOverride {
  @Prop({ required: true, unique: true, immutable: true })
  planId!: string;

  @Prop({ required: true, type: Object })
  plan!: Record<string, unknown>;
}

export const PlanOverrideSchema = SchemaFactory.createForClass(PlanOverride);
