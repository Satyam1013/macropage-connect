import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
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
  getCampaignPerformance(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    if (from || to) {
      return this.analyticsService.getCampaignAnalytics(tenantId, from, to);
    }
    return this.analyticsService.getCampaignPerformance(tenantId);
  }

  @Get("agents")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getAgents(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getAgentAnalytics(tenantId, from, to);
  }

  @Get("contacts")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getContacts(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getContactAnalytics(tenantId, from, to);
  }

  @Get("messages")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getMessages(
    @Request() req: AuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.analyticsService.getMessageAnalytics(tenantId, from, to);
  }
}
