import { PartialType } from "@nestjs/mapped-types";
import { CreateIntegrationPlatformDto } from "./create-integration-platform.dto";

export class UpdateIntegrationPlatformDto extends PartialType(
  CreateIntegrationPlatformDto,
) {}
