import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type APIKeyDocument = HydratedDocument<APIKey> & { createdAt: Date };

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class APIKey {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true })
  keyHash!: string;

  @Prop({ required: true })
  keyPreview!: string;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop()
  expiresAt?: Date;

  @Prop()
  lastUsedAt?: Date;

  @Prop({ type: [String], default: [] })
  ipRestrictions!: string[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 0 })
  requestsToday!: number;
}

export const APIKeySchema = SchemaFactory.createForClass(APIKey);
