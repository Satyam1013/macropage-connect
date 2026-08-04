import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  IntegrationPlatform,
  IntegrationPlatformDocument,
} from "../schemas/integration-platform.schema";
import { CreateIntegrationPlatformDto } from "./dto/create-integration-platform.dto";
import { UpdateIntegrationPlatformDto } from "./dto/update-integration-platform.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { QueryIntegrationPlatformsDto } from "./dto/query-integration-platforms.dto";

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

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

  // ── Platform-staff CRUD ───────────────────────────────────────────────

  async findAllForPlatform(query: QueryIntegrationPlatformsDto) {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.search) filter.name = { $regex: query.search, $options: "i" };

    const [items, categories] = await Promise.all([
      this.platformModel
        .find(filter)
        .sort({ category: 1, sortOrder: 1, name: 1 })
        .exec(),
      this.platformModel.distinct("category").exec(),
    ]);

    return {
      count: items.length,
      categories: (categories as string[]).sort(),
      items,
    };
  }

  async findOneForPlatform(id: string) {
    const platform = await this.platformModel.findById(id).exec();
    if (!platform) {
      throw new NotFoundException("Integration platform not found");
    }
    return platform;
  }

  async create(dto: CreateIntegrationPlatformDto) {
    try {
      return await this.platformModel.create(dto);
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException(
          "A platform with this name already exists in this category",
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateIntegrationPlatformDto) {
    try {
      const platform = await this.platformModel
        .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
        .exec();
      if (!platform) {
        throw new NotFoundException("Integration platform not found");
      }
      return platform;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictException(
          "A platform with this name already exists in this category",
        );
      }
      throw err;
    }
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const platform = await this.platformModel
      .findByIdAndUpdate(
        id,
        { status: dto.status },
        { new: true, runValidators: true },
      )
      .exec();
    if (!platform) {
      throw new NotFoundException("Integration platform not found");
    }
    return platform;
  }

  async remove(id: string) {
    const platform = await this.platformModel.findByIdAndDelete(id).exec();
    if (!platform) {
      throw new NotFoundException("Integration platform not found");
    }
    return platform;
  }
}
