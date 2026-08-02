import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  IntegrationPlatform,
  IntegrationPlatformDocument,
} from "../schemas/integration-platform.schema";

@Injectable()
export class IntegrationPlatformsService {
  constructor(
    @InjectModel(IntegrationPlatform.name)
    private readonly platformModel: Model<IntegrationPlatformDocument>,
  ) {}

  async findAll(
    category?: string,
    search?: string,
  ): Promise<IntegrationPlatformDocument[]> {
    const where: Record<string, unknown> = { status: { $ne: "Inactive" } };
    if (category) where.category = category;
    if (search) where.name = { $regex: search, $options: "i" };

    return this.platformModel
      .find(where)
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .exec();
  }

  async findOne(id: string): Promise<IntegrationPlatformDocument> {
    const platform = await this.platformModel
      .findOne({ _id: id, status: { $ne: "Inactive" } })
      .exec();
    if (!platform)
      throw new NotFoundException("Integration platform not found");
    return platform;
  }
}
