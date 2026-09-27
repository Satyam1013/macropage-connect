import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { LEAD_SOURCES, type LeadSource } from "../../../schemas/lead.schema";

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsIn(LEAD_SOURCES)
  source!: LeadSource;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value?: number;
}
