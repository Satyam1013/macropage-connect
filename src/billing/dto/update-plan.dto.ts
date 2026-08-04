import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

class PlanIntervalDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  billedAs?: string;

  @IsOptional()
  @IsString()
  savings?: string;
}

class PlanPricingDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlanIntervalDto)
  monthly?: PlanIntervalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanIntervalDto)
  quarterly?: PlanIntervalDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanIntervalDto)
  yearly?: PlanIntervalDto;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  badge?: string | null;

  @IsOptional()
  @IsBoolean()
  highlight?: boolean;

  @IsOptional()
  @IsString()
  cta?: string;

  @IsOptional()
  @IsString()
  ctaHref?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  custom?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanPricingDto)
  pricing?: PlanPricingDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notIncluded?: string[];
}
