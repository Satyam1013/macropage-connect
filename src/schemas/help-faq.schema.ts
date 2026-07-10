import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type HelpFaqDocument = HydratedDocument<HelpFaq>;

@Schema({ timestamps: true, collection: "helpfaqs" })
export class HelpFaq {
  @Prop({ required: true }) category!: string;
  @Prop({ default: 0 }) order!: number;
  @Prop({ required: true }) question!: string;
  @Prop({ required: true }) answer!: string;
  @Prop({ type: [String], default: [] }) tags!: string[];
}

export const HelpFaqSchema = SchemaFactory.createForClass(HelpFaq);
HelpFaqSchema.index(
  { question: "text", answer: "text", tags: "text" },
  { weights: { question: 10, tags: 5, answer: 1 } },
);
