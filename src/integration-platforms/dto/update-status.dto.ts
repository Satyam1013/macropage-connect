import { IsEnum } from "class-validator";
import type { IntegrationStatus } from "../../schemas/integration-platform.schema";

export class UpdateStatusDto {
  @IsEnum(["Active", "Inactive", "ComingSoon"])
  status!: IntegrationStatus;
}
