import { IsEnum, IsMongoId, IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class QueryTicketsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsEnum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
  status?: string;

  @IsOptional()
  @IsEnum(["low", "medium", "high", "urgent"])
  priority?: string;

  @IsOptional()
  @IsMongoId()
  tenantId?: string;
}
