import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";

export class SendMessageDto {
  @IsEnum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "AUDIO", "TEMPLATE"])
  type!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  templateVars?: Record<string, string>;
}

export class AddNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsEnum(["OPEN", "PENDING", "RESOLVED"])
  status?: string;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  labels?: string[];
}
