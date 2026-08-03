import { Injectable, NotFoundException } from "@nestjs/common";
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

  async update(
    tenantId: string,
    id: string,
    dto: CreateQrMessageDto,
  ): Promise<QrMessageDocument> {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: id, tenantId },
        { message: dto.message },
        { returnDocument: "after" },
      )
      .exec();
    if (!doc) throw new NotFoundException("QR message not found");
    return doc;
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
