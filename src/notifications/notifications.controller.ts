import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query("page") page?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.notificationsService.findAll(
      tenantId,
      req.user.id,
      page ? Number(page) : 1,
    );
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Request() req: AuthReq, @Param("id") id: string) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.notificationsService.markAllRead(tenantId, req.user.id);
  }
}
