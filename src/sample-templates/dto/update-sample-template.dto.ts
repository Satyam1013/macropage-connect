import { PartialType } from "@nestjs/mapped-types";
import { CreateSampleTemplateDto } from "./create-sample-template.dto";

export class UpdateSampleTemplateDto extends PartialType(
  CreateSampleTemplateDto,
) {}
