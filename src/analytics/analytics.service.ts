import { Injectable, Inject } from "@nestjs/common";
import { UserRole } from "../auth/auth.constants";
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
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  AutomationRule,
  AutomationRuleDocument,
} from "../schemas/automation-rule.schema";
import { ANALYTICS_REDIS } from "./analytics.constants";
import {
  MESSAGING_TIER_LIMITS,
  DEFAULT_MESSAGING_TIER,
  DEFAULT_TIER_LIMIT,
} from "../whatsapp/whatsapp.constants";

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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(AutomationRule.name)
    private readonly ruleModel: Model<AutomationRuleDocument>,
    @Inject(ANALYTICS_REDIS) private readonly redis: Redis,
  ) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private static readonly MONTH_ABBR = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // "2026-07-21" -> "21 Jul". Only day-level buckets have a real calendar
  // date to format this way — week ("%Y-%U") and month ("%Y-%m") buckets
  // are left as-is.
  private formatChartDate(raw: string, groupBy: string): string {
    if (groupBy !== "day") return raw;
    const [, month, day] = raw.split("-");
    if (!month || !day) return raw;
    const monthName = AnalyticsService.MONTH_ABBR[Number(month) - 1];
    if (!monthName) return raw;
    return `${Number(day)} ${monthName}`;
  }

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

  // ─── Contacts-created-by-month (backs /analytics/usage) ───────────────────

  async getContactsCreatedStats(tenantId: string, months: number) {
    const now = new Date();
    const periods: { year: number; month: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    const oldest = periods[periods.length - 1];
    const earliest = new Date(oldest.year, oldest.month - 1, 1);

    const [totalContacts, agg] = await Promise.all([
      this.contactModel.countDocuments({ tenantId }),
      this.contactModel.aggregate<{
        _id: { year: number; month: number };
        count: number;
      }>([
        { $match: { tenantId, createdAt: { $gte: earliest } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const countByPeriod = new Map(
      agg.map((a) => [`${a._id.year}-${a._id.month}`, a.count]),
    );

    const history = periods.map(({ year, month }) => ({
      year,
      month,
      period: `${year}-${String(month).padStart(2, "0")}`,
      contactsCreated: countByPeriod.get(`${year}-${month}`) ?? 0,
    }));

    return {
      totalContacts,
      currentMonthContactsCreated: history[0]?.contactsCreated ?? 0,
      history,
    };
  }

  // ─── All-time usage summary (backs /analytics/usage/all-time) ─────────────

  async getAllTimeStats(tenantId: string) {
    const automatedFilter = {
      tenantId,
      direction: "OUTBOUND" as const,
      isNote: { $ne: true },
      agentId: { $exists: false },
    };

    const [
      totalOutbound,
      totalInbound,
      totalContacts,
      totalConversations,
      campaigns,
      totalRules,
      activeRules,
      automatedConvIds,
    ] = await Promise.all([
      this.msgModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
      }),
      this.msgModel.countDocuments({ tenantId, direction: "INBOUND" }),
      this.contactModel.countDocuments({ tenantId }),
      this.convModel.countDocuments({ tenantId }),
      this.campaignModel.find({ tenantId }).lean().exec(),
      this.ruleModel.countDocuments({ tenantId }),
      this.ruleModel.countDocuments({ tenantId, isEnabled: true }),
      this.msgModel.distinct("conversationId", automatedFilter),
    ]);

    const campaignTotals = campaigns.reduce(
      (acc, c) => ({
        sent: acc.sent + (c.sent ?? 0),
        delivered: acc.delivered + (c.delivered ?? 0),
        read: acc.read + (c.read ?? 0),
        failed: acc.failed + (c.failed ?? 0),
      }),
      { sent: 0, delivered: 0, read: 0, failed: 0 },
    );

    return {
      messages: { totalOutbound, totalInbound },
      contacts: { total: totalContacts },
      conversations: { total: totalConversations },
      campaigns: {
        total: campaigns.length,
        totalSent: campaignTotals.sent,
        totalDelivered: campaignTotals.delivered,
        totalRead: campaignTotals.read,
        totalFailed: campaignTotals.failed,
      },
      automation: {
        totalRules,
        activeRules,
        automatedConversations: automatedConvIds.length,
      },
    };
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
        status: { $ne: "FAILED" },
        createdAt: { $gte: dateFrom, $lte: dateTo },
      }),
      this.msgModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        status: { $ne: "FAILED" },
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
            // Cumulative funnel counts (a read message was also
            // delivered) — based on the timestamp fields, not the single
            // current `status`, since status only holds the latest stage.
            delivered: {
              $sum: { $cond: [{ $ifNull: ["$deliveredAt", false] }, 1, 0] },
            },
            read: {
              $sum: { $cond: [{ $ifNull: ["$readAt", false] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
            },
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

    type MsgEntry = {
      date: string;
      inbound: number;
      outbound: number;
      delivered: number;
      read: number;
      failed: number;
    };
    const messageMap = new Map<string, MsgEntry>();
    for (const item of messageAgg as {
      _id: { date: string; direction: string };
      count: number;
      delivered: number;
      read: number;
      failed: number;
    }[]) {
      const d = item._id.date;
      if (!messageMap.has(d)) {
        messageMap.set(d, {
          date: d,
          inbound: 0,
          outbound: 0,
          delivered: 0,
          read: 0,
          failed: 0,
        });
      }
      const entry = messageMap.get(d)!;
      if (item._id.direction === "INBOUND") entry.inbound += item.count;
      else entry.outbound += item.count;
      entry.delivered += item.delivered;
      entry.read += item.read;
      entry.failed += item.failed;
    }
    const messages = [...messageMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({
        ...m,
        date: this.formatChartDate(m.date, safeGroupBy),
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

  async getDashboardRecent(
    tenantId: string,
    limit = 10,
    requesterId?: string,
    role?: string,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const perType = Math.ceil(safeLimit / 3);

    // AGENTs only ever see their own activity — not other agents', not a
    // manager's/owner's. Campaigns and messages can be attributed to a user
    // (createdBy / conversation.assignedTo); contacts have no owner field
    // at all, so there's no way to prove one is "theirs" — exclude them.
    const isAgentScoped = role === "AGENT" && !!requesterId;

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
          {
            $addFields: {
              conversationObjId: { $toObjectId: "$conversationId" },
            },
          },
          {
            $lookup: {
              from: "conversations",
              localField: "conversationObjId",
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
          ...(isAgentScoped
            ? [{ $match: { "conversation.assignedTo": requesterId } }]
            : []),
          { $limit: perType },
          {
            $addFields: {
              contactObjId: {
                $cond: {
                  if: { $ifNull: ["$conversation.contactId", false] },
                  then: { $toObjectId: "$conversation.contactId" },
                  else: null,
                },
              },
            },
          },
          {
            $lookup: {
              from: "contacts",
              localField: "contactObjId",
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
          .find({
            tenantId,
            status: "COMPLETED",
            completedAt: { $ne: null },
            ...(isAgentScoped ? { createdBy: requesterId } : {}),
          })
          .sort({ completedAt: -1 })
          .limit(perType)
          .select("_id name sent delivered completedAt")
          .lean()
          .exec(),
        isAgentScoped
          ? Promise.resolve([])
          : this.contactModel
              .find({ tenantId })
              .sort({ createdAt: -1 })
              .limit(perType)
              .select("_id name phone createdAt")
              .lean()
              .exec(),
      ],
    );

    type AnyObj = Record<string, unknown>;
    type MsgContact = { _id?: string; name?: string; phone?: string };

    const activities = [
      ...(recentMessages as AnyObj[]).map((m) => ({
        id: String(m._id),
        type: "message",
        title: `New message from ${(m.contact as MsgContact)?.name ?? (m.contact as MsgContact)?.phone ?? "Unknown"}`,
        subtitle: m.content
          ? (m.content as string).substring(0, 60)
          : "Media message",
        timestamp: m.createdAt,
        link: `/inbox?conversationId=${String(m.conversationId)}`,
        meta: {
          contactId: String((m.contact as MsgContact)?._id ?? ""),
          contactName:
            (m.contact as MsgContact)?.name ??
            (m.contact as MsgContact)?.phone ??
            "",
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

    const tier = waba.messagingTier ?? DEFAULT_MESSAGING_TIER;
    const tierLimit = MESSAGING_TIER_LIMITS[tier] ?? DEFAULT_TIER_LIMIT;
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

  // ─── GET /analytics/agents ────────────────────────────────────────────────

  async getAgentAnalytics(tenantId: string, from?: string, to?: string) {
    const { dateFrom, dateTo } = this.getDateRange(from, to);

    const agents = await this.userModel
      .find({
        tenantId,
        role: { $in: [UserRole.AGENT, UserRole.MANAGER, UserRole.ADMIN] },
      })
      .select("_id name avatarUrl role")
      .lean()
      .exec();

    const agentStats = await Promise.all(
      agents.map(async (agent) => {
        const agentId = String(agent._id);
        const [conversations, resolved, messagesSent] = await Promise.all([
          this.convModel.countDocuments({
            tenantId,
            assignedTo: agentId,
            createdAt: { $gte: dateFrom, $lte: dateTo },
          }),
          this.convModel.countDocuments({
            tenantId,
            assignedTo: agentId,
            status: "RESOLVED",
            createdAt: { $gte: dateFrom, $lte: dateTo },
          }),
          this.msgModel.countDocuments({
            tenantId,
            agentId,
            direction: "OUTBOUND",
            isNote: { $ne: true },
            createdAt: { $gte: dateFrom, $lte: dateTo },
          }),
        ]);

        return {
          agent: {
            id: agentId,
            name: agent.name,
            avatarUrl: agent.avatarUrl,
            role: agent.role,
          },
          stats: {
            conversations,
            resolved,
            resolutionRate:
              conversations > 0
                ? Math.round((resolved / conversations) * 100)
                : 0,
            messagesSent,
          },
        };
      }),
    );

    return {
      success: true,
      data: {
        agents: agentStats.sort(
          (a, b) => b.stats.conversations - a.stats.conversations,
        ),
        period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      },
    };
  }

  // ─── GET /analytics/contacts ──────────────────────────────────────────────

  async getContactAnalytics(tenantId: string, from?: string, to?: string) {
    const { dateFrom, dateTo } = this.getDateRange(from, to);
    const cacheKey = `analytics:contacts:${tenantId}:${dateFrom.toDateString()}:${dateTo.toDateString()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return { success: true, data: cached };

    const [totalContacts, newByDay, optOutByDay, topTags] = await Promise.all([
      this.contactModel.countDocuments({ tenantId }),

      this.contactModel.aggregate([
        { $match: { tenantId, createdAt: { $gte: dateFrom, $lte: dateTo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            newContacts: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", newContacts: 1, _id: 0 } },
      ]),

      this.contactModel.aggregate([
        {
          $match: {
            tenantId,
            isOptedOut: true,
            optedOutAt: { $gte: dateFrom, $lte: dateTo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$optedOutAt" },
            },
            optOuts: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: "$_id", optOuts: 1, _id: 0 } },
      ]),

      this.contactModel.aggregate([
        { $match: { tenantId, tags: { $exists: true, $ne: [] } } },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { tag: "$_id", count: 1, _id: 0 } },
      ]),
    ]);

    const data = {
      totalContacts,
      newByDay,
      optOutByDay,
      topTags,
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    };
    await this.cacheSet(cacheKey, data, 300);
    return { success: true, data };
  }

  // ─── GET /analytics/messages ──────────────────────────────────────────────

  async getMessageAnalytics(tenantId: string, from?: string, to?: string) {
    const { dateFrom, dateTo } = this.getDateRange(from, to);
    const cacheKey = `analytics:messages:${tenantId}:${dateFrom.toDateString()}:${dateTo.toDateString()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return { success: true, data: cached };

    const [byType, byDirection, byHour, totalInbound, totalOutbound] =
      await Promise.all([
        this.msgModel.aggregate([
          {
            $match: {
              tenantId,
              isNote: { $ne: true },
              createdAt: { $gte: dateFrom, $lte: dateTo },
            },
          },
          { $group: { _id: "$type", count: { $sum: 1 } } },
          { $project: { type: "$_id", count: 1, _id: 0 } },
        ]),

        this.msgModel.aggregate([
          {
            $match: {
              tenantId,
              isNote: { $ne: true },
              createdAt: { $gte: dateFrom, $lte: dateTo },
            },
          },
          { $group: { _id: "$direction", count: { $sum: 1 } } },
          { $project: { direction: "$_id", count: 1, _id: 0 } },
        ]),

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
              _id: { $hour: "$createdAt" },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { hour: "$_id", count: 1, _id: 0 } },
        ]),

        this.msgModel.countDocuments({
          tenantId,
          direction: "INBOUND",
          createdAt: { $gte: dateFrom, $lte: dateTo },
        }),

        this.msgModel.countDocuments({
          tenantId,
          direction: "OUTBOUND",
          isNote: { $ne: true },
          createdAt: { $gte: dateFrom, $lte: dateTo },
        }),
      ]);

    const data = {
      byType,
      byDirection,
      byHour,
      totalInbound,
      totalOutbound,
      total: totalInbound + totalOutbound,
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    };
    await this.cacheSet(cacheKey, data, 300);
    return { success: true, data };
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

  async getCampaignAnalytics(tenantId: string, from?: string, to?: string) {
    const { dateFrom, dateTo } = this.getDateRange(from, to);
    const cacheKey = `analytics:campaigns:${tenantId}:${dateFrom.toDateString()}:${dateTo.toDateString()}`;
    const cached = await this.cacheGet(cacheKey);
    if (cached) return { success: true, data: cached };

    const campaigns = await this.campaignModel
      .find({
        tenantId,
        status: { $in: ["COMPLETED", "RUNNING", "PAUSED"] },
        startedAt: { $gte: dateFrom, $lte: dateTo },
      })
      .select(
        "_id name status sent delivered read replied failed totalContacts startedAt completedAt",
      )
      .sort({ startedAt: -1 })
      .lean()
      .exec();

    const totalSent = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
    const totalDelivered = campaigns.reduce(
      (s, c) => s + (c.delivered ?? 0),
      0,
    );
    const totalRead = campaigns.reduce((s, c) => s + (c.read ?? 0), 0);
    const totalFailed = campaigns.reduce((s, c) => s + (c.failed ?? 0), 0);

    const volumeByWeek = await this.campaignModel.aggregate([
      {
        $match: {
          tenantId,
          status: { $in: ["COMPLETED", "RUNNING"] },
          startedAt: { $gte: dateFrom, $lte: dateTo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%U", date: "$startedAt" } },
          campaigns: { $sum: 1 },
          totalSent: { $sum: "$sent" },
          totalDelivered: { $sum: "$delivered" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          week: "$_id",
          campaigns: 1,
          totalSent: 1,
          totalDelivered: 1,
          _id: 0,
        },
      },
    ]);

    const data = {
      campaigns,
      summary: {
        totalCampaigns: campaigns.length,
        totalSent,
        totalDelivered,
        deliveryRate:
          totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
        totalRead,
        readRate:
          totalDelivered > 0
            ? Math.round((totalRead / totalDelivered) * 100)
            : 0,
        totalFailed,
      },
      volumeByWeek,
      period: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
    };
    await this.cacheSet(cacheKey, data, 300);
    return { success: true, data };
  }
}
