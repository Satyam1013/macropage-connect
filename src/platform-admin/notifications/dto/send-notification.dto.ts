import { IsArray, IsEnum, IsMongoId, IsString } from "class-validator";
import type { BroadcastChannel } from "../schemas/admin-broadcast.schema";

export class SendNotificationDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsEnum(["in_app", "whatsapp"])
  channel!: BroadcastChannel;

  @IsEnum(["tag", "customer"])
  targetType!: "tag" | "customer";

  @IsArray()
  @IsMongoId({ each: true })
  targetIds!: string[];
}
