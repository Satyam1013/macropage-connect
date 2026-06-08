import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("analytics/dashboard")
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("stats")
  getStats(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getDashboardStats(tenantId, from, to);
  }

  @Get("chart")
  getChart(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("groupBy") groupBy?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getDashboardChart(
      tenantId,
      from,
      to,
      groupBy ?? "day",
    );
  }

  @Get("recent")
  getRecent(@Request() req: AuthReq, @Query("limit") limit?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getDashboardRecent(
      tenantId,
      limit ? Number(limit) : 10,
    );
  }

  @Get("health")
  getHealth(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getDashboardHealth(tenantId);
  }
}
