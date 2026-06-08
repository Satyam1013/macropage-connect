import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("stats")
  getStats(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();
    return this.analyticsService.getStats(tenantId, dateFrom, dateTo);
  }

  @Get("chart")
  getChart(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();
    return this.analyticsService.getChartData(tenantId, dateFrom, dateTo);
  }
}
