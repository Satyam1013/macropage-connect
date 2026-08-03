import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { QrMessageService } from "./qr-message.service";
import { CreateQrMessageDto } from "./dto/create-qr-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("qr-message")
export class QrMessageController {
  constructor(private readonly service: QrMessageService) {}

  @Get()
  findAll(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: CreateQrMessageDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.create(tenantId, req.user.id, dto);
  }
}
