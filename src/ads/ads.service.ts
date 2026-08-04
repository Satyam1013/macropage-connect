import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Ad, AdDocument } from "../schemas/ad.schema";
import { AdTag, AdTagDocument } from "../schemas/ad-tag.schema";
import { CreateAdDto } from "./dto/create-ad.dto";
import { UpdateAdDto } from "./dto/update-ad.dto";

@Injectable()
export class AdsService {
  constructor(
    @InjectModel(Ad.name) private readonly adModel: Model<AdDocument>,
    @InjectModel(AdTag.name) private readonly tagModel: Model<AdTagDocument>,
  ) {}

  // ── Platform-staff CRUD ───────────────────────────────────────────────

  create(dto: CreateAdDto) {
    return this.adModel.create(dto);
  }

  findAllForPlatform(category?: string) {
    const filter = category ? { category } : {};
    return this.adModel.find(filter).sort({ priority: -1 }).exec();
  }

  async findOneForPlatform(id: string) {
    const ad = await this.adModel.findById(id).exec();
    if (!ad) {
      throw new NotFoundException("Ad not found");
    }
    return ad;
  }

  async update(id: string, dto: UpdateAdDto) {
    const ad = await this.adModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!ad) {
      throw new NotFoundException("Ad not found");
    }
    return ad;
  }

  async remove(id: string) {
    const ad = await this.adModel.findByIdAndDelete(id).exec();
    if (!ad) {
      throw new NotFoundException("Ad not found");
    }
    return ad;
  }

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
