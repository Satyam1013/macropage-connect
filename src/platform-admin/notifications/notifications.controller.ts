import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { PlatformNotificationsService } from "./notifications.service";
import { BroadcastNotificationDto } from "./dto/broadcast-notification.dto";
import { SendNotificationDto } from "./dto/send-notification.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../../common/guards/platform-roles.guard";
import { PlatformRoles } from "../../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";

@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@Controller("platform/notifications")
export class PlatformNotificationsController {
  constructor(
    private readonly notificationsService: PlatformNotificationsService,
  ) {}

  @Get()
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  findAll() {
    return this.notificationsService.findAll();
  }

  @Post("broadcast")
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  broadcastToAll(@Body() dto: BroadcastNotificationDto) {
    return this.notificationsService.broadcastToAll(dto);
  }

  @Post("send")
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  sendToTargets(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendToTargets(dto);
  }
}
