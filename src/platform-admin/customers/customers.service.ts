import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { UserRole } from "../../auth/auth.constants";
import { Contact, ContactDocument } from "../../schemas/contact.schema";
import { Message, MessageDocument } from "../../schemas/message.schema";
import { QueryCustomersDto } from "./dto/query-customers.dto";
import { BillingService } from "../../billing/billing.service";
import { MessagesStatsService } from "../messages-stats/messages-stats.service";
import { TagsService } from "../../tags/tags.service";

/** Never let auth secrets from the `users` collection leak through this API. */
const SAFE_PROJECTION =
  "-password -twoFactorSecret -backupCodes -emailVerifyToken -emailVerifyExpires";

/** A "customer" is a tenant account: a `users` doc with role OWNER. */
@Injectable()
export class PlatformCustomersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly billingService: BillingService,
    private readonly messagesStatsService: MessagesStatsService,
    private readonly tagsService: TagsService,
  ) {}

  async findAll(query: QueryCustomersDto) {
    const { page = 1, limit = 20, search, billingPlan, tagId } = query;

    const filter: Record<string, unknown> = { role: "OWNER" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }
    if (billingPlan) filter.billingPlan = billingPlan;
    if (tagId) {
      const customerIds = await this.tagsService.getCustomerIdsForTags([
        tagId,
      ]);
      filter._id = { $in: customerIds };
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter, SAFE_PROJECTION)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    const tenantIds = [
      ...new Set(
        items.map((customer) => String(customer.tenantId ?? customer._id)),
      ),
    ];

    if (tenantIds.length === 0) {
      return { items, total, page, limit };
    }

    const [messageCounts, contactCounts] = await Promise.all([
      this.messageModel.aggregate<{ _id: string; count: number }>([
        { $match: { tenantId: { $in: tenantIds } } },
        { $group: { _id: "$tenantId", count: { $sum: 1 } } },
      ]),
      this.contactModel.aggregate<{ _id: string; count: number }>([
        { $match: { tenantId: { $in: tenantIds } } },
        { $group: { _id: "$tenantId", count: { $sum: 1 } } },
      ]),
    ]);
    const messageCountsByTenant = new Map(
      messageCounts.map(({ _id, count }) => [String(_id), count]),
    );
    const contactCountsByTenant = new Map(
      contactCounts.map(({ _id, count }) => [String(_id), count]),
    );

    return {
      items: items.map((customer) => {
        const tenantId = String(customer.tenantId ?? customer._id);
        return {
          ...customer.toObject(),
          totalMessages: messageCountsByTenant.get(tenantId) ?? 0,
          totalContacts: contactCountsByTenant.get(tenantId) ?? 0,
        };
      }),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const customer = await this.userModel
      .findOne({ _id: id, role: UserRole.OWNER }, SAFE_PROJECTION)
      .exec();
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }

  async getProfile(id: string) {
    const customer = await this.findOne(id);
    const tenantId = customer.tenantId ?? customer.id;

    const [currentPlan, planHistory, messageStats, tags] = await Promise.all([
      this.billingService.getSubscription(tenantId),
      this.billingService.getPlanHistoryForPlatform(tenantId),
      this.messagesStatsService.getStatsForCustomer(tenantId),
      this.tagsService.findTagsForCustomer(id),
    ]);

    return {
      customer,
      currentPlan,
      planHistory,
      messageStats,
      tags,
    };
  }

  /** Cross-tenant dashboard summary — total customers, active subs, today's message stats. */
  async getDashboardStats() {
    const [totalCustomers, totalEnrolledCustomers, globalStats] =
      await Promise.all([
        this.userModel.countDocuments({ role: UserRole.OWNER }),
        this.billingService.countActiveSubscriptions(),
        this.messagesStatsService.getTodayGlobalStats(),
      ]);

    return {
      totalCustomers,
      totalEnrolledCustomers,
      messagesSentToday: globalStats.sentToday,
      messagesFailedToday: globalStats.failedToday,
    };
  }
}
