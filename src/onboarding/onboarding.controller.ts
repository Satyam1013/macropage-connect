import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("checklist")
  getChecklist(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.onboardingService.getChecklist(tenantId, req.user.id);
  }

  @Patch("checklist/:step")
  @HttpCode(HttpStatus.OK)
  completeStep(@Request() req: ProjectAuthReq, @Param("step") step: string) {
    const tenantId = req.projectId;
    return this.onboardingService.completeStep(tenantId, parseInt(step, 10));
  }

  @Patch("dismiss")
  @HttpCode(HttpStatus.OK)
  dismiss(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.onboardingService.dismiss(tenantId);
  }
}
