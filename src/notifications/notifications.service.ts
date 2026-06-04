import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Notification,
  NotificationDocument,
} from "../schemas/notification.schema";
import { EventsGateway } from "../gateway/events.gateway";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
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
}
