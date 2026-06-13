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
import type { AuthReq } from "../auth/dto/auth-request.interface";
import {
  BusinessInfoDto,
  ConfirmPhoneDto,
  ConnectMetaDto,
  VerifyPhoneDto,
} from "./dto/whatsapp.dto";

@UseGuards(JwtAuthGuard)
@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("status")
  getStatus(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.getStatus(tenantId);
  }

  @Post("setup/business-info")
  @HttpCode(HttpStatus.OK)
  saveBusinessInfo(@Request() req: AuthReq, @Body() dto: BusinessInfoDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.saveBusinessInfo(tenantId, dto);
  }

  @Post("connect")
  @HttpCode(HttpStatus.OK)
  connectMeta(@Request() req: AuthReq, @Body() dto: ConnectMetaDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.connectMeta(tenantId, dto);
  }

  @Post("verify-phone/request")
  @HttpCode(HttpStatus.OK)
  requestCode(@Request() req: AuthReq, @Body() dto: VerifyPhoneDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.requestVerificationCode(tenantId, dto);
  }

  @Post("verify-phone/confirm")
  @HttpCode(HttpStatus.OK)
  confirmCode(@Request() req: AuthReq, @Body() dto: ConfirmPhoneDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.confirmVerificationCode(tenantId, dto);
  }

  @Post("setup/send-test")
  @HttpCode(HttpStatus.OK)
  sendTestMessage(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.sendTestMessage(tenantId);
  }

  @Post("setup/complete")
  @HttpCode(HttpStatus.OK)
  completeSetup(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.completeSetup(tenantId);
  }

  @Patch("token")
  @HttpCode(HttpStatus.OK)
  refreshToken(@Request() req: AuthReq, @Body() body: { accessToken: string }) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.refreshToken(tenantId, body.accessToken);
  }

  @Patch("profile")
  @HttpCode(HttpStatus.OK)
  updateProfile(
    @Request() req: AuthReq,
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
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.updateProfile(tenantId, dto);
  }

  @Get("details")
  getDetails(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.getWABADetails(tenantId);
  }

  @Post("share-details")
  @HttpCode(HttpStatus.OK)
  shareDetails(@Request() req: AuthReq, @Body() body: { email?: string }) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const user = { name: req.user.name ?? "User", email: req.user.email };
    return this.whatsappService.shareWABADetails(tenantId, user, body.email);
  }

  @Delete("disconnect")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.disconnect(tenantId);
  }
}
