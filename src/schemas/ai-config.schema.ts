import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AIConfigDocument = HydratedDocument<AIConfig> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class AIConfig {
  @Prop({ required: true, unique: true, index: true })
  tenantId!: string;

  @Prop({ default: false })
  isEnabled!: boolean;

  @Prop({ default: "openai" })
  provider!: string;

  @Prop({ default: "gpt-4o" })
  model!: string;

  @Prop()
  apiKeyEncrypted?: string;

  @Prop({ default: "Assistant" })
  botName!: string;

  @Prop({ default: "friendly" })
  tone!: string;

  @Prop()
  customSystemPrompt?: string;

  @Prop({ default: "auto" })
  language!: string;

  @Prop({ default: true })
  useEmoji!: boolean;

  @Prop({ default: "medium" })
  maxResponseLength!: string;

  @Prop({ default: 70 })
  confidenceThreshold!: number;

  @Prop()
  handoffMessage?: string;

  @Prop({ type: Object, default: {} })
  triggers!: Record<string, unknown>;

  @Prop({ type: [String], default: [] })
  stopWords!: string[];
}

export const AIConfigSchema = SchemaFactory.createForClass(AIConfig);
