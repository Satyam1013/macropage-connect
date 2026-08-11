import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/analytics/dashboard")
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("stats")
  getStats(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    return this.analyticsService.getDashboardStats(tenantId, from, to);
  }

  @Get("chart")
  getChart(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("groupBy") groupBy?: string,
  ) {
    const tenantId = req.projectId;
    return this.analyticsService.getDashboardChart(
      tenantId,
      from,
      to,
      groupBy ?? "day",
    );
  }

  @Get("recent")
  getRecent(@Request() req: ProjectAuthReq, @Query("limit") limit?: string) {
    const tenantId = req.projectId;
    return this.analyticsService.getDashboardRecent(
      tenantId,
      limit ? Number(limit) : 10,
      req.user.id,
      req.user.role,
    );
  }

  @Get("health")
  getHealth(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.analyticsService.getDashboardHealth(tenantId);
  }
}
