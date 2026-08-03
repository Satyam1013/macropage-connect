import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import { NotificationsService } from "./notifications.service";

const TIER_LIMITS: Record<string, number> = {
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: -1,
};

const DAILY_LIMIT_THRESHOLD_PERCENT = 90;
const LOW_DELIVERY_RATE_THRESHOLD = 0.5;
const LOW_DELIVERY_MIN_SENT = 10;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class ScheduledNotificationsService {
  private readonly logger = new Logger(ScheduledNotificationsService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // tenantId is always the owner's own _id — invited team members are the
  // only users that ever get a distinct `tenantId` field stored on them.
  private async findOwnerId(tenantId: string): Promise<string | undefined> {
    const owner = await this.userModel
      .findById(tenantId)
      .select("_id")
      .lean()
      .exec();
    return owner ? String(owner._id) : undefined;
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkTrialEnding(): Promise<void> {
    const candidates = await this.userModel
      .find({
        billingPlan: "TRIAL",
        trialEndsAt: { $exists: true, $ne: null },
        trialEndingNotifiedAt: { $exists: false },
      })
      .select("_id tenantId trialEndsAt")
      .lean()
      .exec();

    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    for (const user of candidates) {
      const trialEndsAt = user.trialEndsAt
        ? new Date(user.trialEndsAt).getTime()
        : NaN;
      if (Number.isNaN(trialEndsAt)) continue;
      if (trialEndsAt - now > threeDaysMs || trialEndsAt < now) continue;

      const tenantId = user.tenantId ?? String(user._id);
      await this.notificationsService.create(
        tenantId,
        String(user._id),
        "trial_ending",
        "Your trial is ending soon",
        "Your trial ends in a few days. Upgrade your plan to keep using Macropage Connect without interruption.",
      );

      await this.userModel.updateOne(
        { _id: user._id },
        { trialEndingNotifiedAt: new Date() },
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkDailyLimitReached(): Promise<void> {
    const today = todayDateString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const wabas = await this.wabaModel
      .find({
        tokenExpired: { $ne: true },
        dailyLimitNotifiedDate: { $ne: today },
      })
      .exec();

    for (const waba of wabas) {
      const tierLimit = TIER_LIMITS[waba.messagingTier] ?? 1000;
      if (tierLimit === -1) continue;

      const messagesToday = await this.messageModel.countDocuments({
        tenantId: waba.tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        createdAt: { $gte: todayStart },
      });

      const usagePercent = (messagesToday / tierLimit) * 100;
      if (usagePercent < DAILY_LIMIT_THRESHOLD_PERCENT) continue;

      const ownerId = await this.findOwnerId(waba.tenantId);
      if (!ownerId) continue;

      await this.notificationsService.create(
        waba.tenantId,
        ownerId,
        "daily_limit_reached",
        "Approaching daily messaging limit",
        `You've used ${messagesToday} of ${tierLimit} messages allowed today on your WhatsApp tier.`,
      );

      await this.wabaModel.updateOne(
        { _id: waba._id },
        { dailyLimitNotifiedDate: today },
      );
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkLowDeliveryRate(): Promise<void> {
    const now = Date.now();
    const windowStart = new Date(now - 26 * 60 * 60 * 1000);
    const windowEnd = new Date(now - 2 * 60 * 60 * 1000);

    const campaigns = await this.campaignModel
      .find({
        status: "COMPLETED",
        completedAt: { $gte: windowStart, $lte: windowEnd },
        sent: { $gte: LOW_DELIVERY_MIN_SENT },
        lowDeliveryNotified: { $ne: true },
      })
      .exec();

    for (const campaign of campaigns) {
      const rate = campaign.delivered / campaign.sent;
      if (rate >= LOW_DELIVERY_RATE_THRESHOLD) {
        await this.campaignModel.updateOne(
          { _id: campaign._id },
          { lowDeliveryNotified: true },
        );
        continue;
      }

      await this.notificationsService.create(
        campaign.tenantId,
        campaign.createdBy,
        "low_delivery_rate",
        `Low delivery rate for "${campaign.name}"`,
        `Only ${campaign.delivered} of ${campaign.sent} messages were delivered (${Math.round(rate * 100)}%). Check your audience list and template quality.`,
        { campaignId: String(campaign._id) },
      );

      await this.campaignModel.updateOne(
        { _id: campaign._id },
        { lowDeliveryNotified: true },
      );
    }
  }
}
