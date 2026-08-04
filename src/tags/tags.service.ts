import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Tag, TagDocument } from "./schemas/tag.schema";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { AssignTagsDto } from "./dto/assign-tags.dto";

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  create(dto: CreateTagDto) {
    return this.tagModel.create(dto);
  }

  findAll() {
    return this.tagModel.find().exec();
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id).exec();
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }
    return tag;
  }

  async update(id: string, dto: UpdateTagDto) {
    const tag = await this.tagModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }
    return tag;
  }

  async remove(id: string) {
    const tag = await this.tagModel.findByIdAndDelete(id).exec();
    if (!tag) {
      throw new NotFoundException("Tag not found");
    }
    return tag;
  }

  /** Replaces this customer's tag set: adds to newly-checked tags, removes from unchecked ones. */
  async assignToCustomer(dto: AssignTagsDto) {
    await Promise.all([
      this.tagModel.updateMany(
        { _id: { $in: dto.tagIds } },
        { $addToSet: { customerIds: dto.customerId } },
      ),
      this.tagModel.updateMany(
        { _id: { $nin: dto.tagIds } },
        { $pull: { customerIds: dto.customerId } },
      ),
    ]);
    return this.findTagsForCustomer(dto.customerId);
  }

  findTagsForCustomer(customerId: string) {
    return this.tagModel.find({ customerIds: customerId }).exec();
  }

  async getCustomerIdsForTags(tagIds: string[]): Promise<string[]> {
    const tags = await this.tagModel
      .find({ _id: { $in: tagIds } })
      .lean()
      .exec();
    return [...new Set(tags.flatMap((t) => t.customerIds))];
  }
}
