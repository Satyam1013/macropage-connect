import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ContactSegmentDocument = HydratedDocument<ContactSegment> & {
  createdAt: Date;
  updatedAt: Date;
};

// User-created saved filter, shown alongside the built-in segments
// (All / Active / New / Silent / Opted out) in the Contacts sidebar.
@Schema({ timestamps: true })
export class ContactSegment {
  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ default: "#6b7280" })
  color!: string;

  @Prop({ type: Object, default: {} })
  filters!: Record<string, unknown>;
}

export const ContactSegmentSchema =
  SchemaFactory.createForClass(ContactSegment);
ContactSegmentSchema.index({ tenantId: 1, name: 1 }, { unique: true });
