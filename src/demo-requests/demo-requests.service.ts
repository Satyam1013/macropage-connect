import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  DemoRequest,
  DemoRequestDocument,
} from "../schemas/demo-request.schema";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";
import { UpdateDemoRequestDto } from "./dto/update-demo-request.dto";

@Injectable()
export class DemoRequestsService {
  constructor(
    @InjectModel(DemoRequest.name)
    private readonly demoRequestModel: Model<DemoRequestDocument>,
  ) {}

  create(
    tenantId: string,
    user: { id: string; name: string; email: string },
    dto: CreateDemoRequestDto,
  ) {
    return this.demoRequestModel.create({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      phone: dto.phone,
      message: dto.message,
    });
  }

  // ── Platform-staff triage ──────────────────────────────────────────────

  async findAllForPlatform(filters: {
    page?: number;
    limit?: number;
    status?: string;
    tenantId?: string;
  }) {
    const { page = 1, limit = 20, status, tenantId } = filters;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (tenantId) filter.tenantId = tenantId;

    const [data, total] = await Promise.all([
      this.demoRequestModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.demoRequestModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneForPlatform(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Demo request not found");
    }
    const demoRequest = await this.demoRequestModel.findById(id).exec();
    if (!demoRequest) {
      throw new NotFoundException("Demo request not found");
    }
    return demoRequest;
  }

  async updateStatus(id: string, dto: UpdateDemoRequestDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Demo request not found");
    }
    const demoRequest = await this.demoRequestModel
      .findByIdAndUpdate(
        id,
        { $set: { status: dto.status } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!demoRequest) {
      throw new NotFoundException("Demo request not found");
    }
    return demoRequest;
  }
}
