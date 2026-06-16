import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  QuickReply,
  QuickReplyDocument,
} from "../schemas/quick-reply.schema";
import { CreateQuickReplyDto } from "./dto/create-quick-reply.dto";

@Injectable()
export class QuickRepliesService {
  constructor(
    @InjectModel(QuickReply.name)
    private readonly model: Model<QuickReplyDocument>,
  ) {}

  async findAll(tenantId: string, search?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (search) {
      where.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
      ];
    }
    const data = await this.model.find(where).sort({ title: 1 }).lean().exec();
    return { success: true, data };
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateQuickReplyDto,
  ): Promise<QuickReplyDocument> {
    try {
      return await this.model.create({
        ...dto,
        tenantId,
        createdBy: userId,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({
          success: false,
          error: {
            code: "DUPLICATE_QUICK_REPLY",
            message: `A quick reply titled "${dto.title}" already exists`,
          },
        });
      }
      throw err;
    }
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateQuickReplyDto>,
  ): Promise<QuickReplyDocument> {
    const doc = await this.model
      .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
      .exec();
    if (!doc) throw new NotFoundException("Quick reply not found");
    return doc;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.model.deleteOne({ _id: id, tenantId }).exec();
    if (!result.deletedCount)
      throw new NotFoundException("Quick reply not found");
  }
}
