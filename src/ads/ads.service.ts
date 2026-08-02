import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Ad, AdDocument } from "../schemas/ad.schema";
import { AdTag, AdTagDocument } from "../schemas/ad-tag.schema";

@Injectable()
export class AdsService {
  constructor(
    @InjectModel(Ad.name) private readonly adModel: Model<AdDocument>,
    @InjectModel(AdTag.name) private readonly tagModel: Model<AdTagDocument>,
  ) {}

  async findActive(tenantId: string): Promise<AdDocument[]> {
    const now = new Date();
    const baseFilter = {
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } },
          ],
        },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] },
      ],
    };

    const tags = await this.tagModel.find({ customerIds: tenantId }).exec();
    const tagIds = tags.map((t) => t._id);

    return this.adModel
      .find({
        ...baseFilter,
        $or: [
          { targetType: "all" },
          { targetType: "customer", targetIds: tenantId },
          { targetType: "tag", targetIds: { $in: tagIds } },
        ],
      })
      .sort({ priority: -1 })
      .exec();
  }
}
