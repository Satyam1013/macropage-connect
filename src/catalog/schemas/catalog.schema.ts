import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CatalogDocument = HydratedDocument<Catalog> & {
  createdAt: Date;
  updatedAt: Date;
};

@Schema({ timestamps: true })
export class Catalog {
  @Prop({ required: true, unique: true, index: true })
  tenantId!: string;

  @Prop()
  metaCatalogId?: string;

  @Prop()
  metaBusinessId?: string;

  @Prop({ default: false })
  isConnected!: boolean;

  @Prop()
  connectedAt?: Date;

  @Prop({ type: String, default: null })
  connectionError?: string | null;
}

export const CatalogSchema = SchemaFactory.createForClass(Catalog);
