import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AutomationRuleDocument = HydratedDocument<AutomationRule> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class AutomationRule {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: true })
  isEnabled!: boolean;

  @Prop({ default: false })
  isBuiltIn!: boolean;

  @Prop({ default: 50 })
  priority!: number;

  @Prop({ type: Object, required: true })
  trigger!: Record<string, unknown>;

  @Prop({ type: Object })
  conditions?: Record<string, unknown>;

  @Prop({ type: Object, required: true })
  actions!: Record<string, unknown>;

  @Prop({ type: Object })
  limits?: Record<string, unknown>;

  @Prop({ default: 0 })
  totalTriggered!: number;

  @Prop()
  lastTriggeredAt?: Date;
}

export const AutomationRuleSchema =
  SchemaFactory.createForClass(AutomationRule);
AutomationRuleSchema.index({ tenantId: 1, isEnabled: 1 });
