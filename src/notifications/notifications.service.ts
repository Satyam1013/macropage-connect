import { Injectable, Inject } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type Redis from "ioredis";
import {
  Notification,
  NotificationDocument,
} from "../schemas/notification.schema";
import {
  NotificationPreferences,
  NotificationPreferencesDocument,
} from "./notification-preferences.schema";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { EventsGateway } from "../gateway/events.gateway";

export const NOTIF_PREFS_REDIS = "NOTIF_PREFS_REDIS";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
    @InjectModel(NotificationPreferences.name)
    private readonly prefModel: Model<NotificationPreferencesDocument>,
    @Inject(NOTIF_PREFS_REDIS)
    private readonly redis: Redis,
    private readonly gateway: EventsGateway,
  ) {}

  async create(
    tenantId: string,
    userId: string | undefined,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<NotificationDocument> {
    const notif = await this.notifModel.create({
      tenantId,
      userId,
      type,
      title,
      body,
      data,
    });
    if (userId) {
      this.gateway.emitToUser(userId, "notification:new", {
        title,
        body,
        type,
      });
    }
    return notif;
  }

  async findAll(tenantId: string, userId: string, page = 1, limit = 20) {
    const where = { tenantId, userId };
    const [data, total, unread] = await Promise.all([
      this.notifModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.notifModel.countDocuments(where),
      this.notifModel.countDocuments({ ...where, isRead: false }),
    ]);
    return { data, total, unread, page, limit };
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.notifModel.updateOne(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
    );
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.notifModel.updateMany(
      { tenantId, userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async getPreferences(tenantId: string, userId: string) {
    const cacheKey = `notif-prefs:${tenantId}:${userId}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return { success: true, data: JSON.parse(cached) as object };
      }
    } catch {
      console.warn("Failed to fetch notification preferences from Redis cache");
    }

    let prefs = await this.prefModel
      .findOne({ tenantId, userId })
      .lean()
      .exec();

    if (!prefs) {
      prefs = (await this.prefModel.create({ tenantId, userId })).toObject();
    }

    const data = {
      channels: prefs.channels,
      events: prefs.events,
      quietHours: prefs.quietHours,
      digest: prefs.digest,
    };

    try {
      await this.redis.set(cacheKey, JSON.stringify(data), "EX", 600);
    } catch {
      console.warn("Failed to store notification preferences in Redis cache");
    }

    return { success: true, data };
  }

  async updatePreferences(
    tenantId: string,
    userId: string,
    dto: UpdatePreferencesDto,
  ) {
    const updateFields: Record<string, unknown> = {};

    if (dto.channels) {
      for (const [k, v] of Object.entries(dto.channels)) {
        updateFields[`channels.${k}`] = v;
      }
    }
    if (dto.events) {
      for (const [event, channelMap] of Object.entries(dto.events)) {
        for (const [channel, enabled] of Object.entries(channelMap)) {
          updateFields[`events.${event}.${channel}`] = enabled;
        }
      }
    }
    if (dto.quietHours) {
      for (const [k, v] of Object.entries(dto.quietHours)) {
        updateFields[`quietHours.${k}`] = v;
      }
    }
    if (dto.digest) {
      for (const [k, v] of Object.entries(dto.digest)) {
        updateFields[`digest.${k}`] = v;
      }
    }

    const updated = await this.prefModel
      .findOneAndUpdate(
        { tenantId, userId },
        { $set: updateFields },
        { returnDocument: "after", upsert: true },
      )
      .lean()
      .exec();

    const data = {
      channels: updated.channels,
      events: updated.events,
      quietHours: updated.quietHours,
      digest: updated.digest,
    };

    try {
      await this.redis.del(`notif-prefs:${tenantId}:${userId}`);
    } catch {
      console.warn(
        "Failed to delete notification preferences from Redis cache",
      );
    }

    return { success: true, data };
  }

  async shouldNotify(
    tenantId: string,
    userId: string,
    eventType: string,
    channel: "email" | "inApp" | "whatsapp",
  ): Promise<boolean> {
    const cacheKey = `notif-prefs:${tenantId}:${userId}`;
    let prefs: NotificationPreferencesDocument | null = null;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        prefs = JSON.parse(cached) as NotificationPreferencesDocument;
      }
    } catch {
      console.warn("Failed to fetch notification preferences from Redis cache");
    }

    if (!prefs) {
      prefs = await this.prefModel.findOne({ tenantId, userId }).lean().exec();
    }

    if (!prefs) return true;

    if (!prefs.channels?.[channel]) return false;

    const eventPrefs = prefs.events?.[eventType];
    if (eventPrefs && eventPrefs[channel] === false) return false;

    if (prefs.quietHours?.enabled && channel !== "inApp") {
      const now = new Date();
      const day = now.getDay();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      if (prefs.quietHours.days?.includes(day)) return false;

      const { from, to } = prefs.quietHours;
      if (from > to) {
        if (timeStr >= from || timeStr <= to) return false;
      } else {
        if (timeStr >= from && timeStr <= to) return false;
      }
    }

    return true;
  }
}
