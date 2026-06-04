import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  WhatsappService,
  ConnectMetaDto,
  VerifyPhoneDto,
  ConfirmPhoneDto,
} from "./whatsapp.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string } };

@UseGuards(JwtAuthGuard)
@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("status")
  getStatus(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.getStatus(tenantId);
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

  @Delete("disconnect")
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.whatsappService.disconnect(tenantId);
  }
}
