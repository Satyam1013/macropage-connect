import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  SampleTemplate,
  SampleTemplateDocument,
} from "../schemas/sample-template.schema";
import { CreateSampleTemplateDto } from "./dto/create-sample-template.dto";
import { UpdateSampleTemplateDto } from "./dto/update-sample-template.dto";

@Injectable()
export class SampleTemplatesService {
  constructor(
    @InjectModel(SampleTemplate.name)
    private readonly sampleTemplateModel: Model<SampleTemplateDocument>,
  ) {}

  // ── Platform-staff CRUD (ported from admin's TemplatesService) ─────────
  // Unlike the tenant-facing reads below, these are not filtered by
  // isActive — platform staff manage inactive/draft samples too.

  create(dto: CreateSampleTemplateDto) {
    // Schema stores header/buttons as loose Record<string, unknown> (see
    // sample-template.schema.ts); the DTO validates their real shape at the
    // API boundary via class-validator, so the cast here is safe.
    return this.sampleTemplateModel.create(
      dto as unknown as Partial<SampleTemplate>,
    );
  }

  findAllForPlatform(category?: string): Promise<SampleTemplateDocument[]> {
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    return this.sampleTemplateModel.find(where).exec();
  }

  async findOneForPlatform(id: string): Promise<SampleTemplateDocument> {
    const template = await this.sampleTemplateModel.findById(id).exec();
    if (!template) {
      throw new NotFoundException("Sample template not found");
    }
    return template;
  }

  async update(
    id: string,
    dto: UpdateSampleTemplateDto,
  ): Promise<SampleTemplateDocument> {
    const template = await this.sampleTemplateModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!template) {
      throw new NotFoundException("Sample template not found");
    }
    return template;
  }

  async remove(id: string): Promise<SampleTemplateDocument> {
    const template = await this.sampleTemplateModel
      .findByIdAndDelete(id)
      .exec();
    if (!template) {
      throw new NotFoundException("Sample template not found");
    }
    return template;
  }

  // ── Tenant-facing reads (existing) ──────────────────────────────────────

  async findAll(category?: string): Promise<SampleTemplateDocument[]> {
    // $ne: false (not isActive: true) so templates created by the admin
    // service — which has its own schema and may never set isActive at
    // all — aren't hidden just for lacking the field. Only an explicit
    // isActive: false hides one.
    const where: Record<string, unknown> = { isActive: { $ne: false } };
    if (category) where.category = category;
    return this.sampleTemplateModel.find(where).sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<SampleTemplateDocument> {
    const doc = await this.sampleTemplateModel
      .findOne({ _id: id, isActive: { $ne: false } })
      .exec();
    if (!doc) throw new NotFoundException("Sample template not found");
    return doc;
  }
}
