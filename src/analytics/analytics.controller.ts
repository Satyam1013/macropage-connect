import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";


@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  getDashboard(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();
    return this.analyticsService.getDashboard(tenantId, dateFrom, dateTo);
  }

  @Get("trends")
  getTrends(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();
    return this.analyticsService.getConversationTrends(
      tenantId,
      dateFrom,
      dateTo,
    );
  }

  @Get("campaigns")
  getCampaignPerformance(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getCampaignPerformance(tenantId);
  }
}
