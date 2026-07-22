import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { MessageUsageService } from "./message-usage.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import type { AuthReq } from "../auth/dto/auth-request.interface";

// Meta rates shown to frontend for display — keep in sync with META_RATES
// in message-usage.service.ts (paise there, rupees here for the UI)
const META_RATES_DISPLAY = {
  marketing: 0.86,
  utility: 0.115,
  authentication: 0.115,
  service: 0,
  currency: "INR",
  lastUpdated: "January 1, 2026",
};

@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly messageUsageService: MessageUsageService,
  ) {}

  @Get("usage")
  async getUsage(@Request() req: AuthReq, @Query("months") months?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const [current, history] = await Promise.all([
      this.messageUsageService.getCurrentMonthUsage(tenantId),
      this.messageUsageService.getUsageHistory(
        tenantId,
        parseInt(months ?? "6", 10),
      ),
    ]);

    const estimatedCostRupees = current.estimatedCostPaise / 100;

    return {
      success: true,
      data: {
        currentMonth: {
          ...current,
          estimatedCostRupees,
          estimatedCostFormatted: new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(estimatedCostRupees),
        },
        history,
        metaRates: META_RATES_DISPLAY,
      },
    };
  }

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
