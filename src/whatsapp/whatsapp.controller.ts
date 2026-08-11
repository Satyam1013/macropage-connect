import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";
import {
  BusinessInfoDto,
  ConfirmPhoneDto,
  ConnectMetaDto,
  VerifyPhoneDto,
} from "./dto/whatsapp.dto";
import { RegisterPhoneDto } from "./dto/register-phone.dto";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/whatsapp")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("status")
  getStatus(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.whatsappService.getStatus(tenantId);
  }

  @Get("setup/business-info")
  getBusinessInfo(@Request() req: ProjectAuthReq) {
    return this.whatsappService.getBusinessInfo(req.projectId);
  }

  @Post("setup/business-info")
  @HttpCode(HttpStatus.OK)
  saveBusinessInfo(
    @Request() req: ProjectAuthReq,
    @Body() dto: BusinessInfoDto,
  ) {
    const tenantId = req.projectId;
    return this.whatsappService.saveBusinessInfo(tenantId, dto);
  }

  @Post("connect")
  @HttpCode(HttpStatus.OK)
  connectMeta(@Request() req: ProjectAuthReq, @Body() dto: ConnectMetaDto) {
    const tenantId = req.projectId;
    return this.whatsappService.connectMeta(tenantId, dto);
  }

  @Post("verify-phone/request")
  @HttpCode(HttpStatus.OK)
  requestCode(@Request() req: ProjectAuthReq, @Body() dto: VerifyPhoneDto) {
    const tenantId = req.projectId;
    return this.whatsappService.requestVerificationCode(tenantId, dto);
  }

  @Post("verify-phone/confirm")
  @HttpCode(HttpStatus.OK)
  confirmCode(@Request() req: ProjectAuthReq, @Body() dto: ConfirmPhoneDto) {
    const tenantId = req.projectId;
    return this.whatsappService.confirmVerificationCode(tenantId, dto);
  }

  @Post("setup/send-test")
  @HttpCode(HttpStatus.OK)
  sendTestMessage(
    @Request() req: ProjectAuthReq,
    @Body("toPhone") toPhone?: string,
  ) {
    const tenantId = req.projectId;
    return this.whatsappService.sendTestMessage(tenantId, toPhone);
  }

  @Post("setup/complete")
  @HttpCode(HttpStatus.OK)
  completeSetup(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.whatsappService.completeSetup(tenantId);
  }

  @Patch("token")
  @HttpCode(HttpStatus.OK)
  refreshToken(
    @Request() req: ProjectAuthReq,
    @Body() body: { accessToken: string },
  ) {
    const tenantId = req.projectId;
    return this.whatsappService.refreshToken(tenantId, body.accessToken);
  }

  @Patch("profile")
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @Request() req: ProjectAuthReq,
    @Body()
    dto: {
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      websites?: string[];
      vertical?: string;
    },
  ) {
    const tenantId = req.projectId;
    return this.whatsappService.updateProfile(tenantId, dto);
  }

  @Get("details")
  getDetails(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.whatsappService.getWABADetails(tenantId);
  }

  @Post("share-details")
  @HttpCode(HttpStatus.OK)
  shareDetails(
    @Request() req: ProjectAuthReq,
    @Body() body: { email?: string },
  ) {
    const tenantId = req.projectId;
    const user = { name: req.user.name ?? "User", email: req.user.email };
    return this.whatsappService.shareWABADetails(tenantId, user, body.email);
  }

  @Post("register-phone")
  @HttpCode(HttpStatus.OK)
  registerPhone(@Request() req: ProjectAuthReq, @Body() dto: RegisterPhoneDto) {
    const tenantId = req.projectId;
    return this.whatsappService.registerPhoneNumber(tenantId, dto);
  }

  @Get("registration-status")
  getRegistrationStatus(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.whatsappService.getRegistrationStatus(tenantId);
  }

  @Delete(["disconnect", "setup/disconnect"])
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.whatsappService.disconnect(tenantId);
  }
}
