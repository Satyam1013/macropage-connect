import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";

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

export class SendCatalogMessageDto {
  // 1 = single product, 2-30 = multi-product (Meta's product_list limit)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  productIds!: string[];
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
