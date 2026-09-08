import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ProductDocument = HydratedDocument<Product> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  // in paise (₹499 = 49900)
  @Prop({ required: true })
  price!: number;

  @Prop({ default: "INR" })
  currency!: string;

  @Prop()
  sku?: string;

  // uploaded via existing DO Spaces upload infrastructure (POST /upload/image)
  @Prop({ type: [String], default: [] })
  imageUrls!: string[];

  @Prop()
  category?: string;

  @Prop({ enum: ["in_stock", "out_of_stock"], default: "in_stock" })
  availability!: string;

  @Prop({ default: true })
  isActive!: boolean;

  // Meta's product ID once synced — unset until pushed
  @Prop()
  metaProductId?: string;

  @Prop({
    enum: ["pending", "synced", "failed", "not_synced"],
    default: "not_synced",
  })
  syncStatus!: string;

  @Prop()
  syncError?: string;

  @Prop()
  lastSyncedAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ tenantId: 1, createdAt: -1 });
ProductSchema.index({ tenantId: 1, metaProductId: 1 });
