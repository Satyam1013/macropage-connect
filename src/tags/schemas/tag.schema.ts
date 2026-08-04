import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TagDocument = HydratedDocument<Tag> & {
  createdAt: Date;
  updatedAt: Date;
};

// Platform-staff-owned customer segmentation tags. Same shared `tags`
// collection ads.module.ts's AdTag reads to resolve tag-targeted ads.
@Schema({ timestamps: true, collection: "tags" })
export class Tag {
  @Prop({ required: true, unique: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ trim: true })
  description?: string;

  /** users collection ids (customers) this tag is applied to. */
  @Prop({ type: [String], default: [] })
  customerIds!: string[];
}

export const TagSchema = SchemaFactory.createForClass(Tag);
