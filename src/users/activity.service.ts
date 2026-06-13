import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ActivityLog,
  ActivityLogDocument,
} from "../schemas/activity-log.schema";

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityModel: Model<ActivityLogDocument>,
  ) {}

  async getUserActivity(
    tenantId: string,
    userId: string,
    page = 1,
    limit = 20,
    type?: string,
  ) {
    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;
    const filter: Record<string, unknown> = { tenantId, userId };
    if (type) filter.type = type;

    const [activities, total] = await Promise.all([
      this.activityModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.activityModel.countDocuments(filter),
    ]);

    return {
      success: true,
      data: {
        activities: activities.map((a) => ({
          _id: a._id,
          type: a.type,
          description: a.description,
          meta: a.meta,
          ipAddress: a.ipAddress,
          device: a.device,
          status: a.status,
          createdAt: a.createdAt,
        })),
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async log(data: {
    tenantId: string;
    userId: string;
    type: string;
    description: string;
    meta?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    status?: "success" | "failed";
  }): Promise<void> {
    try {
      await this.activityModel.create({
        tenantId: data.tenantId,
        userId: data.userId,
        type: data.type,
        description: data.description,
        meta: data.meta ?? {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        device: this.detectDevice(data.userAgent),
        status: data.status ?? "success",
      });
    } catch (err) {
      console.error(
        "[ActivityLog] Failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private detectDevice(userAgent?: string): string {
    if (!userAgent) return "unknown";
    const ua = userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)/.test(ua)) return "tablet";
    if (/(mobi|android|touch|mini|windows phone)/.test(ua)) return "mobile";
    return "desktop";
  }
}
