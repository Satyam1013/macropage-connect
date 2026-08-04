import { IsEnum, IsString } from "class-validator";
import type { BroadcastChannel } from "../schemas/admin-broadcast.schema";

export class BroadcastNotificationDto {
  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsEnum(["in_app", "whatsapp"])
  channel!: BroadcastChannel;
}
