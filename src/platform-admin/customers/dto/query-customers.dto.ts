import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { Transform, Type } from "class-transformer";

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

  // Deleted accounts are hidden unless asked for, via either param.
  @IsOptional()
  @IsEnum(["active", "suspended", "deleted"])
  accountStatus?: "active" | "suspended" | "deleted";

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeDeleted?: boolean;
}
