import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type AdType = "popup" | "banner" | "inline";
export type AdTargetType = "all" | "tag" | "customer";

export type AdDocument = HydratedDocument<Ad> & {
  createdAt: Date;
  updatedAt: Date;
};

// Admin-curated in-app promos/announcements — admin owns full CRUD in the
// separate admin panel against this same `ads` collection, same pattern as
// SampleTemplate/IntegrationPlatform. For targetType "customer", targetIds
// holds this tenant's own User _id (admin's "customerId"); for "tag" it
// holds Tag _ids from the mirrored Tag collection below.
@Schema({ timestamps: true, collection: "ads" })
export class Ad {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  mediaUrl!: string;

  @Prop({ type: String, enum: ["popup", "banner", "inline"], required: true })
  type!: AdType;

  @Prop({ type: String, enum: ["all", "tag", "customer"], default: "all" })
  targetType!: AdTargetType;

  @Prop({ type: [Types.ObjectId], default: [] })
  targetIds!: Types.ObjectId[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop({ default: 0 })
  priority!: number;
}

export const AdSchema = SchemaFactory.createForClass(Ad);
