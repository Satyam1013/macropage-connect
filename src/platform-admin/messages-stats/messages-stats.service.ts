import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "../../schemas/message.schema";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../../schemas/tenant.schema";
import { UserRole } from "../../auth/auth.constants";
import { BillingService } from "../../billing/billing.service";
import { QueryMessageLogsDto } from "./dto/query-message-logs.dto";
import {
  QueryMessageStatsDto,
  StatsGroupBy,
} from "./dto/query-message-stats.dto";

@Injectable()
export class MessagesStatsService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly billingService: BillingService,
  ) {}

  /** "customerId" here is the tenant's own user id (== tenantId). */
  async findLogs(query: QueryMessageLogsDto) {
    const { page = 1, limit = 20, customerId, status, from, to } = query;

    const filter: Record<string, unknown> = { direction: "OUTBOUND" };
    if (customerId) filter.tenantId = customerId;
    if (status) filter.status = status;
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.$gte = new Date(from);
      if (to) createdAt.$lte = new Date(to);
      filter.createdAt = createdAt;
    }

    const [messages, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.messageModel.countDocuments(filter),
    ]);

    const ownersByTenant = await this.resolveTenantOwners([
      ...new Set([
        ...messages.map((m) => m.tenantId),
        ...(customerId ? [customerId] : []),
      ]),
    ]);

    const data = messages.map((m) => ({
      ...m,
      customerName: ownersByTenant.get(m.tenantId)?.name ?? null,
    }));

    if (!customerId) {
      return { data, total, page, limit };
    }

    // Scoped to one customer: also return their plan + purchase history so
    // the admin panel doesn't need a second round-trip to /billing.
    const owner = ownersByTenant.get(customerId);
    const [currentPlan, purchaseLogs] = await Promise.all([
      this.billingService.getSubscription(customerId),
      this.billingService.getPlanHistoryForPlatform(customerId),
    ]);

    return {
      data,
      total,
      page,
      limit,
      customer: {
        _id: customerId,
        name: owner?.name ?? null,
        email: owner?.email ?? null,
        company: owner?.company ?? null,
        billingPlan: owner?.billingPlan ?? null,
      },
      currentPlan,
      purchaseLogs,
    };
  }

  /**
   * tenantId -> owning user. Covers both conventions: legacy tenants whose
   * id is the owner's own User _id (or a member's `tenantId`), and
   * standalone Tenant docs created via /auth/create-project (owner via
   * Tenant.ownerId).
   */
  private async resolveTenantOwners(tenantIds: string[]) {
    const owners = new Map<
      string,
      Pick<User, "name" | "email" | "company" | "billingPlan">
    >();
    if (tenantIds.length === 0) return owners;

    const objectIds = tenantIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const tenants = await this.tenantModel
      .find({ _id: { $in: objectIds } })
      .select("ownerId")
      .lean()
      .exec();
    const ownerIdByTenant = new Map(
      tenants.map((t) => [String(t._id), t.ownerId]),
    );
    const ownerObjectIds = [...ownerIdByTenant.values()]
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const users = await this.userModel
      .find({
        $or: [
          { _id: { $in: [...objectIds, ...ownerObjectIds] } },
          { tenantId: { $in: tenantIds }, role: UserRole.OWNER },
        ],
      })
      .select("name email company billingPlan tenantId")
      .lean()
      .exec();
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const ownerByLegacyTenantId = new Map(
      users.filter((u) => u.tenantId).map((u) => [String(u.tenantId), u]),
    );

    for (const tenantId of tenantIds) {
      const ownerId = ownerIdByTenant.get(tenantId);
      const user =
        (ownerId && userById.get(ownerId)) ||
        userById.get(tenantId) ||
        ownerByLegacyTenantId.get(tenantId);
      if (user) owners.set(tenantId, user);
    }
    return owners;
  }

  async getStats(query: QueryMessageStatsDto) {
    const { customerId, groupBy = "day", from, to } = query;

    const match: Record<string, unknown> = { direction: "OUTBOUND" };
    if (customerId) match.tenantId = customerId;
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.$gte = new Date(from);
      if (to) createdAt.$lte = new Date(to);
      match.createdAt = createdAt;
    }

    if (groupBy === "week") {
      const results = await this.messageModel.aggregate<{
        _id: { y: number; w: number };
        total: number;
        failed: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: {
              y: { $isoWeekYear: "$createdAt" },
              w: { $isoWeek: "$createdAt" },
            },
            total: { $sum: 1 },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
            },
          },
        },
        { $sort: { "_id.y": 1, "_id.w": 1 } },
      ]);

      return results.map((r) => ({
        period: `${r._id.y}-W${String(r._id.w).padStart(2, "0")}`,
        sent: r.total - r.failed,
        failed: r.failed,
        total: r.total,
      }));
    }

    const dateFormat = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

    const results = await this.messageModel.aggregate<{
      _id: string;
      total: number;
      failed: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          total: { $sum: 1 },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({
      period: r._id,
      sent: r.total - r.failed,
      failed: r.failed,
      total: r.total,
    }));
  }

  /** Per-customer message counts for the requested timeline (defaults to the current day/week/month). */
  async getCustomerStats(query: QueryMessageStatsDto) {
    const { customerId, groupBy = "day", from, to } = query;

    const match: Record<string, unknown> = { direction: "OUTBOUND" };
    if (customerId) match.tenantId = customerId;
    if (from || to) {
      const createdAt: Record<string, Date> = {};
      if (from) createdAt.$gte = new Date(from);
      if (to) createdAt.$lte = new Date(to);
      match.createdAt = createdAt;
    } else {
      match.createdAt = { $gte: this.startOfCurrentPeriod(groupBy) };
    }

    const results = await this.messageModel.aggregate<{
      _id: string;
      total: number;
      failed: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: "$tenantId",
          total: { $sum: 1 },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "FAILED"] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    if (results.length === 0) {
      return [];
    }

    const tenantIds = results.map((r) => r._id);
    const objectIds = tenantIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const users = await this.userModel
      .find({
        $or: [{ tenantId: { $in: tenantIds } }, { _id: { $in: objectIds } }],
      })
      .select("name email company tenantId")
      .lean()
      .exec();

    const userByTenantId = new Map(
      users.map((u) => [String(u.tenantId ?? u._id), u]),
    );

    return results.map((r) => {
      const user = userByTenantId.get(r._id);
      return {
        tenantId: r._id,
        name: user?.name ?? null,
        email: user?.email ?? null,
        company: user?.company ?? null,
        sent: r.total - r.failed,
        failed: r.failed,
        total: r.total,
      };
    });
  }

  private startOfCurrentPeriod(groupBy: StatsGroupBy): Date {
    const now = new Date();
    if (groupBy === "week") {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - daysSinceMonday,
      );
    }
    if (groupBy === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  async getStatsForCustomer(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const base = { tenantId, direction: "OUTBOUND" as const };

    const [today, thisMonth, total, failedTotal] = await Promise.all([
      this.messageModel.countDocuments({
        ...base,
        createdAt: { $gte: startOfToday },
      }),
      this.messageModel.countDocuments({
        ...base,
        createdAt: { $gte: startOfMonth },
      }),
      this.messageModel.countDocuments(base),
      this.messageModel.countDocuments({ ...base, status: "FAILED" }),
    ]);

    return { today, thisMonth, total, failedTotal };
  }

  async getTodayGlobalStats() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const base = {
      direction: "OUTBOUND" as const,
      createdAt: { $gte: startOfToday },
    };

    const [total, failedToday] = await Promise.all([
      this.messageModel.countDocuments(base),
      this.messageModel.countDocuments({ ...base, status: "FAILED" }),
    ]);

    return { sentToday: total - failedToday, failedToday };
  }
}
