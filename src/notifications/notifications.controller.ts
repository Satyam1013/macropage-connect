import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("preferences")
  getPreferences(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.notificationsService.getPreferences(tenantId, req.user.id);
  }

  @Put("preferences")
  @HttpCode(HttpStatus.OK)
  updatePreferences(
    @Request() req: ProjectAuthReq,
    @Body() dto: UpdatePreferencesDto,
  ) {
    const tenantId = req.projectId;
    return this.notificationsService.updatePreferences(
      tenantId,
      req.user.id,
      dto,
    );
  }

  @Get("unread-count")
  getUnreadCount(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.notificationsService.getUnreadCount(tenantId, req.user.id);
  }

  @Get()
  findAll(@Request() req: ProjectAuthReq, @Query("page") page?: string) {
    const tenantId = req.projectId;
    return this.notificationsService.findAll(
      tenantId,
      req.user.id,
      page ? Number(page) : 1,
    );
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.notificationsService.markAllRead(tenantId, req.user.id);
  }
}
