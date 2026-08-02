import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AdTagDocument = HydratedDocument<AdTag> & {
  createdAt: Date;
  updatedAt: Date;
};

// Admin-owned customer segmentation tags, read here only to resolve which
// Ads (see ad.schema.ts) target this tenant. Same shared `tags` collection
// the admin panel's Tag schema writes to.
@Schema({ timestamps: true, collection: "tags" })
export class AdTag {
  @Prop({ required: true, unique: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [String], default: [] })
  customerIds!: string[];
}

export const AdTagSchema = SchemaFactory.createForClass(AdTag);
