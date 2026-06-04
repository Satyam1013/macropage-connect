import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SessionDocument = HydratedDocument<Session> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Session {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  device?: string;

  @Prop()
  browser?: string;

  @Prop()
  os?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  location?: string;

  @Prop()
  lastActiveAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
