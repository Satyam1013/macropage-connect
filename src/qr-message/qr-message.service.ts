import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { QrMessage, QrMessageDocument } from "../schemas/qr-message.schema";
import { CreateQrMessageDto } from "./dto/create-qr-message.dto";

@Injectable()
export class QrMessageService {
  constructor(
    @InjectModel(QrMessage.name)
    private readonly model: Model<QrMessageDocument>,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateQrMessageDto,
  ): Promise<QrMessageDocument> {
    return this.model.create({
      tenantId,
      createdBy: userId,
      message: dto.message,
    });
  }

  async findAll(tenantId: string) {
    const data = await this.model
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return { success: true, data };
  }
}
