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
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("checklist")
  getChecklist(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.onboardingService.getChecklist(tenantId, req.user.id);
  }

  @Patch("checklist/:step")
  @HttpCode(HttpStatus.OK)
  completeStep(@Request() req: AuthReq, @Param("step") step: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.onboardingService.completeStep(tenantId, parseInt(step, 10));
  }

  @Patch("dismiss")
  @HttpCode(HttpStatus.OK)
  dismiss(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.onboardingService.dismiss(tenantId);
  }
}
