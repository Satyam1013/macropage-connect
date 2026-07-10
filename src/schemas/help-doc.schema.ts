import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HelpDocDocument = HydratedDocument<HelpDoc>;

@Schema({ timestamps: true, collection: "helpdocs" })
export class HelpDoc {
  @Prop({ required: true }) title!: string;
  @Prop({ required: true, unique: true }) slug!: string;
  @Prop({ required: true }) category!: string;
  @Prop({ default: 0 }) order!: number;
  @Prop({ type: [String], default: [] }) tags!: string[];
  @Prop({ required: true }) content!: string;
}

export const HelpDocSchema = SchemaFactory.createForClass(HelpDoc);
HelpDocSchema.index(
  { title: "text", content: "text", tags: "text" },
  { weights: { title: 10, tags: 5, content: 1 } },
);
