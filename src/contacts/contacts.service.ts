import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { CreateContactDto } from "./dto/create-contact.dto";
import type { ContactFilters } from "./contacts.types";

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
  ) {}

  async findAll(tenantId: string, filters: ContactFilters = {}) {
    const { search, tags, isOptedOut, page = 1, limit = 20 } = filters;
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
      .findOneAndUpdate({ _id: id, tenantId }, dto, { new: true })
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
        { upsert: true, new: true },
      )
      .exec();
    return doc!;
  }
}
