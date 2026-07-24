import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  SampleTemplate,
  SampleTemplateDocument,
} from "../schemas/sample-template.schema";

@Injectable()
export class SampleTemplatesService {
  constructor(
    @InjectModel(SampleTemplate.name)
    private readonly sampleTemplateModel: Model<SampleTemplateDocument>,
  ) {}

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
