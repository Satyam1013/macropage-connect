import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { IntegrationStatus } from "../../schemas/integration-platform.schema";

export class CreateIntegrationPlatformDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(50)
  category!: string;

  @IsOptional()
  @IsEnum(["Active", "Inactive", "ComingSoon"])
  status?: IntegrationStatus;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}
