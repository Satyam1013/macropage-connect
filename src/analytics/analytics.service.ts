import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";

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
  ) {}

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

  async getMessageStats(tenantId: string, dateFrom: Date, dateTo: Date) {
    return this.msgModel.aggregate([
      { $match: { tenantId, createdAt: { $gte: dateFrom, $lte: dateTo } } },
      {
        $group: {
          _id: "$direction",
          count: { $sum: 1 },
        },
      },
    ]);
  }
}
