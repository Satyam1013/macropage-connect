import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import {
  ContactSegment,
  ContactSegmentDocument,
} from "../schemas/contact-segment.schema";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import type { ContactFilters } from "./contacts.types";

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(ContactSegment.name)
    private readonly segmentModel: Model<ContactSegmentDocument>,
  ) {}

  private buildWhere(
    tenantId: string,
    filters: Pick<ContactFilters, "search" | "tags" | "isOptedOut">,
  ): Record<string, unknown> {
    const { search, tags, isOptedOut } = filters;
    const where: Record<string, unknown> = { tenantId };

    if (search) {
      where.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (tags?.length) where.tags = { $in: tags };
    if (isOptedOut !== undefined) where.isOptedOut = isOptedOut;

    return where;
  }

  async findAll(tenantId: string, filters: ContactFilters = {}) {
    const { page = 1, limit = 20 } = filters;
    const where = this.buildWhere(tenantId, filters);

    const [data, total] = await Promise.all([
      this.contactModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(where),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<ContactDocument> {
    const contact = await this.contactModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async create(
    tenantId: string,
    dto: CreateContactDto,
  ): Promise<ContactDocument> {
    const existing = await this.contactModel
      .findOne({ tenantId, phone: dto.phone })
      .exec();
    if (existing)
      throw new ConflictException("Contact with this phone already exists");

    return this.contactModel.create({ ...dto, tenantId });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateContactDto>,
  ): Promise<ContactDocument> {
    const contact = await this.contactModel
      .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
      .exec();
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.contactModel
      .deleteOne({ _id: id, tenantId })
      .exec();
    if (!result.deletedCount) throw new NotFoundException("Contact not found");
  }

  async bulkTag(
    tenantId: string,
    ids: string[],
    tags: string[],
    action: "add" | "remove",
  ): Promise<void> {
    if (action === "add") {
      await this.contactModel.updateMany(
        { _id: { $in: ids }, tenantId },
        { $addToSet: { tags: { $each: tags } } },
      );
    } else {
      await this.contactModel.updateMany(
        { _id: { $in: ids }, tenantId },
        { $pullAll: { tags } },
      );
    }
  }

  async optOut(tenantId: string, phone: string): Promise<void> {
    await this.contactModel.updateOne(
      { tenantId, phone },
      { isOptedOut: true, optedOutAt: new Date() },
    );
  }

  async getSegments(tenantId: string) {
    const [total, subscribed, unsubscribed, tagAgg, customSegments] =
      await Promise.all([
        this.contactModel.countDocuments({ tenantId }),
        this.contactModel.countDocuments({ tenantId, isOptedOut: false }),
        this.contactModel.countDocuments({ tenantId, isOptedOut: true }),
        this.contactModel.aggregate<{ _id: string; count: number }>([
          { $match: { tenantId, tags: { $exists: true, $ne: [] } } },
          { $unwind: "$tags" },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        this.segmentModel.find({ tenantId }).sort({ createdAt: -1 }).exec(),
      ]);

    const predefined = [
      { id: "all", name: "All Contacts", count: total, type: "predefined" },
      {
        id: "subscribed",
        name: "Subscribed",
        count: subscribed,
        type: "predefined",
      },
      {
        id: "unsubscribed",
        name: "Unsubscribed",
        count: unsubscribed,
        type: "predefined",
      },
    ];

    const tagSegments = tagAgg.map((t) => ({
      id: `tag:${t._id}`,
      name: t._id,
      count: t.count,
      type: "tag",
    }));

    const customSegmentsWithCount = await Promise.all(
      customSegments.map(async (s) => {
        const where = this.buildWhere(tenantId, s.filters);
        return {
          id: String(s._id),
          name: s.name,
          color: s.color,
          filters: s.filters,
          count: await this.contactModel.countDocuments(where),
          type: "custom",
        };
      }),
    );

    return {
      success: true,
      data: {
        segments: [...predefined, ...tagSegments, ...customSegmentsWithCount],
      },
    };
  }

  async createSegment(
    tenantId: string,
    dto: CreateSegmentDto,
  ): Promise<ContactSegmentDocument> {
    return this.segmentModel.create({
      tenantId,
      name: dto.name,
      color: dto.color,
      filters: dto.filters ?? {},
    });
  }

  findByPhone(
    tenantId: string,
    phone: string,
  ): Promise<ContactDocument | null> {
    return this.contactModel.findOne({ tenantId, phone }).exec();
  }

  async findOrCreate(
    tenantId: string,
    phone: string,
    name?: string,
  ): Promise<ContactDocument> {
    const doc = await this.contactModel
      .findOneAndUpdate(
        { tenantId, phone },
        { $setOnInsert: { tenantId, phone, name: name ?? phone } },
        { returnDocument: "after", upsert: true, sort: { _id: 1 } },
      )
      .exec();
    return doc;
  }
}
