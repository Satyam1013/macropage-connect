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
  @IsString()
  templateId?: string;

  @IsOptional()
  templateVars?: Record<string, string>;

  // Frontend sends the resolved {{n}} values under "variables" —
  // accepted alongside templateVars so neither naming gets silently
  // stripped by the global ValidationPipe's whitelist.
  @IsOptional()
  variables?: Record<string, string>;

  @IsOptional()
  header?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  buttons?: unknown[];
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
