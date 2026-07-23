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
    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    return this.sampleTemplateModel.find(where).sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<SampleTemplateDocument> {
    const doc = await this.sampleTemplateModel
      .findOne({ _id: id, isActive: true })
      .exec();
    if (!doc) throw new NotFoundException("Sample template not found");
    return doc;
  }
}
