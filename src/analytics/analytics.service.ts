import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type Redis from "ioredis";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { ANALYTICS_REDIS } from "./analytics.constants";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @Inject(ANALYTICS_REDIS) private readonly redis: Redis,
  ) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private getDateRange(from?: string, to?: string) {
    const dateTo = to ? new Date(to) : new Date();
    const dateFrom = from
      ? new Date(from)
      : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const diffMs = dateTo.getTime() - dateFrom.getTime();
    const prevFrom = new Date(dateFrom.getTime() - diffMs);
    const prevTo = new Date(dateTo.getTime() - diffMs);
    return { dateFrom, dateTo, prevFrom, prevTo };
  }

  private calcTrend(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private async cacheGet(key: string): Promise<unknown> {
    try {
      const val = await this.redis.get(key);
      return val ? (JSON.parse(val) as unknown) : null;
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, value: unknown, ttl: number) {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch {
      // Redis down — proceed without cache
    }
  }

  // ─── GET /analytics/dashboard/stats ───────────────────────────────────────

  async getDashboardStats(tenantId: string, from?: string, to?: string) {
    const { dateFrom, dateTo, prevFrom, prevTo } = this.getDateRange(from, to);
    const cacheKey = `dashboard:stats:${tenantId}:${dateFrom.toDateString()}:${dateTo.toDateString()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return { success: true, data: cached };

    const [
      totalConversations,
      prevConversations,
      totalMessages,
      prevMessages,
      totalContacts,
      prevContacts,
      totalCampaigns,
      prevCampaigns,
    ] = await Promise.all([
      this.convModel.countDocuments({
        tenantId,
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.convModel.countDocuments({
        tenantId,
        createdAt: { $gte: prevFrom, $lte: prevTo },
      }),
      this.msgModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.msgModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        createdAt: { $gte: prevFrom, $lte: prevTo },
      }),
      this.contactModel.countDocuments({
        tenantId,
        lastMessageAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.contactModel.countDocuments({
        tenantId,
        lastMessageAt: { $gte: prevFrom, $lte: prevTo },
      }),
      this.campaignModel.countDocuments({
        tenantId,
        status: { $in: ["COMPLETED", "RUNNING"] },
        startedAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.campaignModel.countDocuments({
        tenantId,
        status: { $in: ["COMPLETED", "RUNNING"] },
        startedAt: { $gte: prevFrom, $lte: prevTo },
      }),
    ]);

    const data = {
      conversations: {
        value: totalConversations,
        trend: this.calcTrend(totalConversations, prevConversations),
        label: "Conversations",
      },
      messagesSent: {
        value: totalMessages,
        trend: this.calcTrend(totalMessages, prevMessages),
        label: "Messages sent",
      },
      activeContacts: {
        value: totalContacts,
        trend: this.calcTrend(totalContacts, prevContacts),
        label: "Active contacts",
      },
      campaigns: {
        value: totalCampaigns,
        trend: this.calcTrend(totalCampaigns, prevCampaigns),
        label: "Campaigns",
      },
      period: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
      },
    };

    await this.cacheSet(cacheKey, data, 120);
    return { success: true, data };
  }

  // ─── GET /analytics/dashboard/chart ───────────────────────────────────────

  async getDashboardChart(
    tenantId: string,
    from?: string,
    to?: string,
    groupBy = "day",
  ) {
    const { dateFrom, dateTo } = this.getDateRange(from, to);
    const safeGroupBy = ["day", "week", "month"].includes(groupBy)
      ? groupBy
      : "day";
    const dateFormat =
      safeGroupBy === "month"
        ? "%Y-%m"
        : safeGroupBy === "week"
          ? "%Y-%U"
          : "%Y-%m-%d";

    const cacheKey = `dashboard:chart:${tenantId}:${dateFrom.toDateString()}:${dateTo.toDateString()}:${safeGroupBy}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return { success: true, data: cached };

    const [messageAgg, conversationAgg] = await Promise.all([
      this.msgModel.aggregate([
        {
          $match: {
            tenantId,
            isNote: { $ne: true },
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: dateFormat, date: "$createdAt" },
              },
              direction: "$direction",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),
      this.convModel.aggregate([
        {
          $match: {
            tenantId,
            createdAt: { $gte: dateFrom, $lte: dateTo },
          },
        },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: dateFormat, date: "$createdAt" },
              },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.date": 1 } },
      ]),
    ]);

    type MsgEntry = { date: string; inbound: number; outbound: number };
    const messageMap = new Map<string, MsgEntry>();
    for (const item of messageAgg as {
      _id: { date: string; direction: string };
      count: number;
    }[]) {
      const d = item._id.date;
      if (!messageMap.has(d))
        messageMap.set(d, { date: d, inbound: 0, outbound: 0 });
      const entry = messageMap.get(d)!;
      if (item._id.direction === "INBOUND") entry.inbound += item.count;
      else entry.outbound += item.count;
    }
    const messages = [...messageMap.values()].map((m) => ({
      ...m,
      total: m.inbound + m.outbound,
    }));

    type ConvEntry = { date: string; total: number; resolved: number };
    const convMap = new Map<string, ConvEntry>();
    for (const item of conversationAgg as {
      _id: { date: string; status: string };
      count: number;
    }[]) {
      const d = item._id.date;
      if (!convMap.has(d)) convMap.set(d, { date: d, total: 0, resolved: 0 });
      const entry = convMap.get(d)!;
      entry.total += item.count;
      if (item._id.status === "RESOLVED") entry.resolved += item.count;
    }
    const conversations = [...convMap.values()];

    const data = {
      messages,
      conversations,
      groupBy: safeGroupBy,
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    };

    await this.cacheSet(cacheKey, data, 300);
    return { success: true, data };
  }

  // ─── GET /analytics/dashboard/recent ──────────────────────────────────────

  async getDashboardRecent(tenantId: string, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const perType = Math.ceil(safeLimit / 3);

    const [recentMessages, recentCampaigns, recentContacts] = await Promise.all(
      [
        this.msgModel.aggregate([
          {
            $match: {
              tenantId,
              direction: "INBOUND",
              isNote: { $ne: true },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: perType },
          {
            $lookup: {
              from: "conversations",
              localField: "conversationId",
              foreignField: "_id",
              as: "conversation",
            },
          },
          {
            $unwind: {
              path: "$conversation",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: "contacts",
              localField: "conversation.contactId",
              foreignField: "_id",
              as: "contact",
            },
          },
          {
            $unwind: {
              path: "$contact",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              _id: 1,
              content: 1,
              createdAt: 1,
              conversationId: 1,
              "contact._id": 1,
              "contact.name": 1,
              "contact.phone": 1,
            },
          },
        ]),
        this.campaignModel
          .find({ tenantId, status: "COMPLETED", completedAt: { $ne: null } })
          .sort({ completedAt: -1 })
          .limit(perType)
          .select("_id name sent delivered completedAt")
          .lean()
          .exec(),
        this.contactModel
          .find({ tenantId })
          .sort({ createdAt: -1 })
          .limit(perType)
          .select("_id name phone createdAt")
          .lean()
          .exec(),
      ],
    );

    type AnyObj = Record<string, unknown>;
    type MsgContact = { _id?: string; name?: string };

    const activities = [
      ...(recentMessages as AnyObj[]).map((m) => ({
        id: String(m._id),
        type: "message",
        title: `New message from ${(m.contact as MsgContact)?.name ?? "Unknown"}`,
        subtitle: m.content
          ? (m.content as string).substring(0, 60)
          : "Media message",
        timestamp: m.createdAt,
        link: `/inbox?conversationId=${String(m.conversationId)}`,
        meta: {
          contactId: String((m.contact as MsgContact)?._id ?? ""),
          contactName: (m.contact as MsgContact)?.name ?? "",
          conversationId: String(m.conversationId),
        },
      })),
      ...(recentCampaigns as unknown as AnyObj[]).map((c) => ({
        id: String(c._id),
        type: "campaign",
        title: `Campaign "${String(c.name)}" completed`,
        subtitle: `${String((c.sent as number | null) ?? 0)} sent · ${String((c.delivered as number | null) ?? 0)} delivered`,
        timestamp: c.completedAt,
        link: `/campaigns/${String(c._id)}`,
        meta: { sent: c.sent, delivered: c.delivered },
      })),
      ...(recentContacts as unknown as AnyObj[]).map((c) => ({
        id: String(c._id),
        type: "contact",
        title: "New contact added",
        subtitle: `${String(c.name)} · ${String(c.phone)}`,
        timestamp: c.createdAt,
        link: `/contacts/${String(c._id)}`,
        meta: {
          contactId: String(c._id),
          name: c.name,
          phone: c.phone,
        },
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp as string).getTime() -
          new Date(a.timestamp as string).getTime(),
      )
      .slice(0, safeLimit);

    return { success: true, data: activities };
  }

  // ─── GET /analytics/dashboard/health ──────────────────────────────────────

  async getDashboardHealth(tenantId: string) {
    const waba = await this.wabaModel
      .findOne({ tenantId })
      .select(
        "metaConnected qualityRating messagingTier tokenExpired phoneNumber displayName phoneNumberId",
      )
      .lean()
      .exec();

    if (!waba?.metaConnected) {
      return { success: true, data: { connected: false } };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const messagesSentToday = await this.msgModel.countDocuments({
      tenantId,
      direction: "OUTBOUND",
      isNote: { $ne: true },
      createdAt: { $gte: todayStart },
    });

    const tierLimits: Record<string, number> = {
      TIER_1K: 1000,
      TIER_10K: 10000,
      TIER_100K: 100000,
      TIER_UNLIMITED: -1,
    };

    const tier = waba.messagingTier ?? "TIER_1K";
    const tierLimit = tierLimits[tier] ?? 1000;
    const usagePercent =
      tierLimit === -1
        ? 0
        : Math.min(Math.round((messagesSentToday / tierLimit) * 100), 100);

    return {
      success: true,
      data: {
        connected: true,
        qualityRating: waba.qualityRating ?? "GREEN",
        messagingTier: tier,
        tokenExpired: waba.tokenExpired ?? false,
        phoneNumber: waba.phoneNumber,
        displayName: waba.displayName,
        phoneNumberId: waba.phoneNumberId,
        messagesSentToday,
        tierLimit,
        usagePercent,
      },
    };
  }

  // ─── Legacy methods (used by AnalyticsController) ─────────────────────────

  async getDashboard(tenantId: string, dateFrom: Date, dateTo: Date) {
    const [
      totalConversations,
      resolvedConversations,
      totalMessages,
      activeContacts,
      campaigns,
    ] = await Promise.all([
      this.convModel.countDocuments({
        tenantId,
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.convModel.countDocuments({
        tenantId,
        status: "RESOLVED",
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.msgModel.countDocuments({
        tenantId,
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.contactModel.countDocuments({
        tenantId,
        lastMessageAt: { $gte: dateFrom },
      }),
      this.campaignModel
        .find({ tenantId, createdAt: { $gte: dateFrom, $lte: dateTo } })
        .exec(),
    ]);

    const resolutionRate =
      totalConversations > 0
        ? (resolvedConversations / totalConversations) * 100
        : 0;
    const avgDeliveryRate =
      campaigns.length > 0
        ? campaigns.reduce(
            (sum, c) =>
              sum +
              (c.totalContacts > 0 ? (c.delivered / c.totalContacts) * 100 : 0),
            0,
          ) / campaigns.length
        : 0;

    return {
      totalConversations,
      resolvedConversations,
      resolutionRate: Math.round(resolutionRate),
      totalMessages,
      activeContacts,
      campaigns: campaigns.length,
      avgDeliveryRate: Math.round(avgDeliveryRate),
    };
  }

  async getConversationTrends(tenantId: string, dateFrom: Date, dateTo: Date) {
    return this.convModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: dateFrom, $lte: dateTo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getCampaignPerformance(tenantId: string) {
    return this.campaignModel
      .find({ tenantId, status: { $in: ["COMPLETED", "RUNNING"] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }
}
