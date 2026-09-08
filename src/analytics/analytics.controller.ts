import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { MessageUsageService } from "./message-usage.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

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

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly messageUsageService: MessageUsageService,
  ) {}

  @Get("usage")
  async getUsage(
    @Request() req: ProjectAuthReq,
    @Query("months") months?: string,
  ) {
    const tenantId = req.projectId;
    const monthCount = parseInt(months ?? "6", 10);
    const [current, history, contactStats] = await Promise.all([
      this.messageUsageService.getCurrentMonthUsage(tenantId),
      this.messageUsageService.getUsageHistory(tenantId, monthCount),
      this.analyticsService.getContactsCreatedStats(tenantId, monthCount),
    ]);

    const estimatedCostRupees = current.estimatedCostPaise / 100;
    const contactsByPeriod = new Map(
      contactStats.history.map((h) => [h.period, h.contactsCreated]),
    );

    return {
      success: true,
      data: {
        currentMonth: {
          ...current,
          contactsCreated: contactStats.currentMonthContactsCreated,
          totalContacts: contactStats.totalContacts,
          estimatedCostRupees,
          estimatedCostFormatted: new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(estimatedCostRupees),
        },
        history: history.map((h) => ({
          ...h,
          contactsCreated: contactsByPeriod.get(h.period) ?? 0,
        })),
        metaRates: META_RATES_DISPLAY,
      },
    };
  }

  @Get("usage/all-time")
  async getAllTimeUsage(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    const [stats, messageUsage] = await Promise.all([
      this.analyticsService.getAllTimeStats(tenantId),
      this.messageUsageService.getAllTimeUsage(tenantId),
    ]);

    const estimatedCostRupees = messageUsage.estimatedCostPaise / 100;

    return {
      success: true,
      data: {
        messages: {
          ...stats.messages,
          byCategory: {
            marketing: messageUsage.marketingCount,
            utility: messageUsage.utilityCount,
            authentication: messageUsage.authenticationCount,
            service: messageUsage.serviceCount,
            note: "Category breakdown only reflects messages sent since usage tracking was enabled — totalOutbound/totalInbound above cover the tenant's full history.",
          },
          campaignMessages: messageUsage.campaignMessages,
          inboxMessages: messageUsage.inboxMessages,
          estimatedCostPaise: messageUsage.estimatedCostPaise,
          estimatedCostRupees,
          estimatedCostFormatted: new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(estimatedCostRupees),
        },
        contacts: stats.contacts,
        conversations: stats.conversations,
        campaigns: stats.campaigns,
        automation: stats.automation,
        metaRates: META_RATES_DISPLAY,
      },
    };
  }

  @Get("dashboard")
  getDashboard(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();
    return this.analyticsService.getDashboard(tenantId, dateFrom, dateTo);
  }

  @Get("trends")
  getTrends(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
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
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    if (from || to) {
      return this.analyticsService.getCampaignAnalytics(tenantId, from, to);
    }
    return this.analyticsService.getCampaignPerformance(tenantId);
  }

  @Get("agents")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getAgents(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    return this.analyticsService.getAgentAnalytics(tenantId, from, to);
  }

  @Get("contacts")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getContacts(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    return this.analyticsService.getContactAnalytics(tenantId, from, to);
  }

  @Get("messages")
  @UseGuards(PlanGuard)
  @RequirePlan("advancedAnalytics")
  getMessages(
    @Request() req: ProjectAuthReq,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const tenantId = req.projectId;
    return this.analyticsService.getMessageAnalytics(tenantId, from, to);
  }
}
