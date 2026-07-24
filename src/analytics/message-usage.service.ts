import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { MessageUsage, MessageUsageDocument } from "./message-usage.schema";

export type MessageCategory =
  | "marketing"
  | "utility"
  | "authentication"
  | "service";

// Meta India 2026 rates in paise. Update when Meta changes rates
// (Meta updates quarterly on Jan 1, Apr 1, Jul 1, Oct 1)
const META_RATES: Record<MessageCategory, number> = {
  marketing: 86, // ₹0.86
  utility: 12, // ₹0.115 (rounded)
  authentication: 12, // ₹0.115
  service: 0, // free within 24hr window
};

@Injectable()
export class MessageUsageService {
  private readonly logger = new Logger(MessageUsageService.name);

  constructor(
    @InjectModel(MessageUsage.name)
    private readonly usageModel: Model<MessageUsageDocument>,
  ) {}

  // Call after every successful outbound message send.
  // Never throws — tracking must not block the actual message send.
  async trackOutbound(
    tenantId: string,
    category: MessageCategory,
    count = 1,
    source: "campaign" | "inbox" = "inbox",
  ): Promise<void> {
    try {
      const { year, month } = this.currentPeriod();
      const costPaise = (META_RATES[category] ?? 0) * count;

      const inc: Record<string, number> = {
        totalOutbound: count,
        estimatedCostPaise: costPaise,
      };

      if (category === "marketing") inc.marketingCount = count;
      else if (category === "utility") inc.utilityCount = count;
      else if (category === "authentication") inc.authenticationCount = count;
      else inc.serviceCount = count;

      if (source === "campaign") inc.campaignMessages = count;
      else inc.inboxMessages = count;

      await this.usageModel.updateOne(
        { tenantId, year, month },
        { $inc: inc },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error(
        "Track outbound usage failed",
        err instanceof Error ? err.stack : err,
      );
    }
  }

  // Call after every inbound message is saved. Never throws.
  async trackInbound(tenantId: string, count = 1): Promise<void> {
    try {
      const { year, month } = this.currentPeriod();
      await this.usageModel.updateOne(
        { tenantId, year, month },
        { $inc: { totalInbound: count } },
        { upsert: true },
      );
    } catch (err) {
      this.logger.error(
        "Track inbound usage failed",
        err instanceof Error ? err.stack : err,
      );
    }
  }

  async getCurrentMonthUsage(tenantId: string) {
    const { year, month } = this.currentPeriod();
    const usage = await this.usageModel
      .findOne({ tenantId, year, month })
      .lean();

    return {
      year,
      month,
      marketingCount: usage?.marketingCount ?? 0,
      utilityCount: usage?.utilityCount ?? 0,
      authenticationCount: usage?.authenticationCount ?? 0,
      serviceCount: usage?.serviceCount ?? 0,
      totalOutbound: usage?.totalOutbound ?? 0,
      totalInbound: usage?.totalInbound ?? 0,
      campaignMessages: usage?.campaignMessages ?? 0,
      inboxMessages: usage?.inboxMessages ?? 0,
      estimatedCostPaise: usage?.estimatedCostPaise ?? 0,
    };
  }

  async getUsageHistory(tenantId: string, months = 6) {
    const records = await this.usageModel
      .find({ tenantId })
      .sort({ year: -1, month: -1 })
      .limit(months)
      .lean();

    return records.map((r) => ({
      period: `${r.year}-${String(r.month).padStart(2, "0")}`,
      year: r.year,
      month: r.month,
      marketingCount: r.marketingCount ?? 0,
      utilityCount: r.utilityCount ?? 0,
      authenticationCount: r.authenticationCount ?? 0,
      serviceCount: r.serviceCount ?? 0,
      totalOutbound: r.totalOutbound ?? 0,
      totalInbound: r.totalInbound ?? 0,
      campaignMessages: r.campaignMessages ?? 0,
      inboxMessages: r.inboxMessages ?? 0,
      estimatedCostPaise: r.estimatedCostPaise ?? 0,
    }));
  }

  // Sums every tracked month for this tenant. Only reflects messages sent
  // since usage tracking was wired up (trackOutbound/trackInbound calls),
  // not the tenant's full message history — callers wanting a true
  // all-time send/receive count should use the Message collection instead.
  async getAllTimeUsage(tenantId: string) {
    const [agg] = await this.usageModel.aggregate<{
      marketingCount: number;
      utilityCount: number;
      authenticationCount: number;
      serviceCount: number;
      totalOutbound: number;
      totalInbound: number;
      campaignMessages: number;
      inboxMessages: number;
      estimatedCostPaise: number;
      monthsTracked: number;
    }>([
      { $match: { tenantId } },
      {
        $group: {
          _id: null,
          marketingCount: { $sum: "$marketingCount" },
          utilityCount: { $sum: "$utilityCount" },
          authenticationCount: { $sum: "$authenticationCount" },
          serviceCount: { $sum: "$serviceCount" },
          totalOutbound: { $sum: "$totalOutbound" },
          totalInbound: { $sum: "$totalInbound" },
          campaignMessages: { $sum: "$campaignMessages" },
          inboxMessages: { $sum: "$inboxMessages" },
          estimatedCostPaise: { $sum: "$estimatedCostPaise" },
          monthsTracked: { $sum: 1 },
        },
      },
    ]);

    return {
      marketingCount: agg?.marketingCount ?? 0,
      utilityCount: agg?.utilityCount ?? 0,
      authenticationCount: agg?.authenticationCount ?? 0,
      serviceCount: agg?.serviceCount ?? 0,
      totalOutbound: agg?.totalOutbound ?? 0,
      totalInbound: agg?.totalInbound ?? 0,
      campaignMessages: agg?.campaignMessages ?? 0,
      inboxMessages: agg?.inboxMessages ?? 0,
      estimatedCostPaise: agg?.estimatedCostPaise ?? 0,
      monthsTracked: agg?.monthsTracked ?? 0,
    };
  }

  private currentPeriod() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
}
