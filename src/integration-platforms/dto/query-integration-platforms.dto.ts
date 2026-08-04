import { IsEnum, IsOptional, IsString } from "class-validator";
import type { IntegrationStatus } from "../../schemas/integration-platform.schema";

export class QueryIntegrationPlatformsDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(["Active", "Inactive", "ComingSoon"])
  status?: IntegrationStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
