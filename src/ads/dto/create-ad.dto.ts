import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import type { AdTargetType, AdType } from "../../schemas/ad.schema";

export class CreateAdDto {
  @IsString()
  title!: string;

  @IsString()
  mediaUrl!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category!: string;

  @IsEnum(["popup", "banner", "inline"])
  type!: AdType;

  @IsOptional()
  @IsEnum(["all", "tag", "customer"])
  targetType?: AdTargetType;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  targetIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priority?: number;
}
