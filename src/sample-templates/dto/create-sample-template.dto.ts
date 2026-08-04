import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { TemplateCategory } from "../../templates/templates.types";

export type SampleTemplateHeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";

export class SampleTemplateHeaderDto {
  @IsEnum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"])
  format!: SampleTemplateHeaderFormat;

  @IsOptional()
  @IsString()
  text?: string;
}

export class SampleTemplateButtonDto {
  @IsString()
  type!: string;

  @IsString()
  text!: string;
}

export class SampleTemplateButtonsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleTemplateButtonDto)
  buttons!: SampleTemplateButtonDto[];
}

// Ported from admin's CreateTemplateDto
// (apps/admin/src/macropage-connect/templates/dto/create-template.dto.ts,
// now deleted) — same shape, same `sampletemplates` collection.
export class CreateSampleTemplateDto {
  @IsString()
  name!: string;

  @IsEnum(["MARKETING", "UTILITY", "AUTHENTICATION"])
  category!: TemplateCategory;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SampleTemplateHeaderDto)
  header?: SampleTemplateHeaderDto;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  footer?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SampleTemplateButtonsDto)
  buttons?: SampleTemplateButtonsDto;

  @IsOptional()
  @IsObject()
  sampleVariables?: Record<string, string>;

  @IsOptional()
  @IsObject()
  variableTypes?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
