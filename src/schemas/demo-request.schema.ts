import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DemoRequestDocument = HydratedDocument<DemoRequest> & {
  createdAt: Date;
  updatedAt: Date;
};

// Raised by Connect portal users, triaged in the separate admin panel —
// collection name is explicit so both services agree on it (must match
// the `demorequests` collection the macropage-admin DemoRequest schema
// reads from).
@Schema({ timestamps: true, collection: "demorequests" })
export class DemoRequest {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  userName!: string;

  @Prop({ required: true })
  userEmail!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop()
  message?: string;

  @Prop({
    type: String,
    enum: ["PENDING", "CONTACTED", "SCHEDULED", "COMPLETED", "CANCELLED"],
    default: "PENDING",
    index: true,
  })
  status!: string;
}

export const DemoRequestSchema = SchemaFactory.createForClass(DemoRequest);
