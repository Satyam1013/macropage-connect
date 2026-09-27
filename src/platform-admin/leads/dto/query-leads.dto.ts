import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  type LeadSource,
  type LeadStage,
} from "../../../schemas/lead.schema";

export class QueryLeadsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(LEAD_STAGES)
  stage?: LeadStage;

  @IsOptional()
  @IsIn(LEAD_SOURCES)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  search?: string;
}
