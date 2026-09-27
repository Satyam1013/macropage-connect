import { IsIn } from "class-validator";
import { LEAD_STAGES, type LeadStage } from "../../../schemas/lead.schema";

export class UpdateLeadStageDto {
  @IsIn(LEAD_STAGES)
  stage!: LeadStage;
}
