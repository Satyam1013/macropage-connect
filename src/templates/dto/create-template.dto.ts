import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  Matches,
} from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: "Name must be lowercase letters, numbers and underscores only",
  })
  name!: string;

  @IsEnum(["MARKETING", "UTILITY", "AUTHENTICATION"])
  category!: string;

  @IsString()
  language!: string;

  @IsOptional()
  header?: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  buttons?: Record<string, unknown>;

  @IsOptional()
  sampleVariables?: Record<string, unknown>;
}
