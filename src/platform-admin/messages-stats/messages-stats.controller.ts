import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MessagesStatsService } from "./messages-stats.service";
import { QueryMessageLogsDto } from "./dto/query-message-logs.dto";
import { QueryMessageStatsDto } from "./dto/query-message-stats.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../../common/guards/platform-roles.guard";
import { PlatformRoles } from "../../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";

@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
@Controller("platform/messages")
export class MessagesStatsController {
  constructor(private readonly messagesStatsService: MessagesStatsService) {}

  @Get("logs")
  findLogs(@Query() query: QueryMessageLogsDto) {
    return this.messagesStatsService.findLogs(query);
  }

  @Get("stats")
  getStats(@Query() query: QueryMessageStatsDto) {
    return this.messagesStatsService.getStats(query);
  }

  @Get("stats/customers")
  getCustomerStats(@Query() query: QueryMessageStatsDto) {
    return this.messagesStatsService.getCustomerStats(query);
  }
}
