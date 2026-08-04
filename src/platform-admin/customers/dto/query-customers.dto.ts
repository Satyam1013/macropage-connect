import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

export class QueryCustomersDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(["TRIAL", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"])
  billingPlan?: string;

  @IsOptional()
  @IsMongoId()
  tagId?: string;
}
