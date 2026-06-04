import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type WABAAccountDocument = HydratedDocument<WABAAccount> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class WABAAccount {
  @Prop({ required: true, unique: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  wabaId!: string;

  @Prop({ required: true })
  phoneNumberId!: string;

  @Prop({ required: true })
  phoneNumber!: string;

  @Prop()
  displayName?: string;

  @Prop()
  businessName?: string;

  @Prop({ required: true })
  accessToken!: string;

  @Prop()
  tokenExpiresAt?: Date;

  @Prop({ default: false })
  tokenExpired!: boolean;

  @Prop({ default: false })
  metaConnected!: boolean;

  @Prop()
  qualityRating?: string;

  @Prop({ default: "TIER_1K" })
  messagingTier!: string;

  @Prop({ default: false })
  webhookVerified!: boolean;

  @Prop()
  connectedAt?: Date;
}

export const WABAAccountSchema = SchemaFactory.createForClass(WABAAccount);
