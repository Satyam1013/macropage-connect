import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop()
  phone?: string;

  @Prop()
  company?: string;

  @Prop({ default: "user" })
  role!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ default: false })
  whatsappSetupDone!: boolean;

  @Prop({ type: String, enum: ["FREE", "PRO"], default: "FREE" })
  plan!: "FREE" | "PRO";

  @Prop({ required: true })
  trialEndsAt!: string;

  @Prop({ default: false })
  marketingOptIn!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
