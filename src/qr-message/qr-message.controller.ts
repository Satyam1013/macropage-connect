import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { QrMessageService } from "./qr-message.service";
import { CreateQrMessageDto } from "./dto/create-qr-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/qr-message")
export class QrMessageController {
  constructor(private readonly service: QrMessageService) {}

  @Get()
  findAll(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.service.findAll(tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: ProjectAuthReq, @Body() dto: CreateQrMessageDto) {
    const tenantId = req.projectId;
    return this.service.create(tenantId, req.user.id, dto);
  }

  @Put(":id")
  update(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: CreateQrMessageDto,
  ) {
    const tenantId = req.projectId;
    return this.service.update(tenantId, id, dto);
  }
}
