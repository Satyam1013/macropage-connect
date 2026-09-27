import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Lead,
  LeadDocument,
  LEAD_STAGES,
  TERMINAL_LEAD_STAGES,
  type LeadStage,
} from "../../schemas/lead.schema";
import { QueryLeadsDto } from "./dto/query-leads.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

@Injectable()
export class PlatformLeadsService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  async findAll(tenantId: string, query: QueryLeadsDto) {
    const { page = 1, limit = 20, stage, source, search } = query;

    const filter: Record<string, unknown> = { tenantId };
    if (stage) filter.stage = stage;
    if (source) filter.source = source;
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ name: regex }, { company: regex }, { phone: regex }];
    }

    const [data, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.leadModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  create(tenantId: string, dto: CreateLeadDto) {
    return this.leadModel.create({ ...dto, tenantId, stage: "NEW" });
  }

  async updateStage(tenantId: string, id: string, stage: LeadStage) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Lead not found");
    }
    const lead = await this.leadModel.findOne({ _id: id, tenantId }).exec();
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    if (lead.stage !== stage && TERMINAL_LEAD_STAGES.includes(lead.stage)) {
      throw new BadRequestException({
        success: false,
        code: "LEAD_CLOSED",
        message: `Lead is already ${lead.stage} and can't be moved.`,
      });
    }

    lead.stage = stage;
    return lead.save();
  }

  /** Count per stage, with every stage present (0 when empty). */
  async getStats(tenantId: string) {
    const rows = await this.leadModel.aggregate<{
      _id: LeadStage;
      count: number;
    }>([
      { $match: { tenantId } },
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<
      LeadStage,
      number
    >;
    for (const { _id, count } of rows) counts[_id] = count;
    return counts;
  }
}
