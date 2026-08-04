import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type VideoTutorialDocument = HydratedDocument<VideoTutorial>;

@Schema({ timestamps: true, collection: "videotutorials" })
export class VideoTutorial {
  @Prop({ required: true }) url!: string;
  @Prop() title?: string;
  @Prop({ default: 0 }) order!: number;
}

export const VideoTutorialSchema = SchemaFactory.createForClass(VideoTutorial);
