import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import ExcelJS from "exceljs";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import {
  ContactSegment,
  ContactSegmentDocument,
} from "../schemas/contact-segment.schema";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import type { ContactFilters } from "./contacts.types";

const IMPORT_COLUMNS = [
  "name",
  "phone",
  "email",
  "company",
  "city",
  "state",
  "country",
  "jobtitle",
  "tags",
] as const;

function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((r) => r.text)
        .join("")
        .trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("result" in value && value.result !== undefined) {
      return cellToText(value.result);
    }
    return "";
  }
  return String(value).trim();
}

function normalizeImportPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // 10-digit Indian mobile (6-9 prefix) stored without country code
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

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

  async importFromExcel(tenantId: string, buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new BadRequestException(
        "Could not read file — please upload a valid .xlsx file",
      );
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException("The uploaded file has no sheets");
    }

    const headerRow = sheet.getRow(1);
    const columnIndex = new Map<(typeof IMPORT_COLUMNS)[number], number>();
    headerRow.eachCell((cell, colNumber) => {
      const key = cellToText(cell.value).toLowerCase().replace(/\s+/g, "");
      if ((IMPORT_COLUMNS as readonly string[]).includes(key)) {
        columnIndex.set(key as (typeof IMPORT_COLUMNS)[number], colNumber);
      }
    });

    if (!columnIndex.has("name") || !columnIndex.has("phone")) {
      throw new BadRequestException(
        "Sheet must have 'name' and 'phone' columns in the header row",
      );
    }

    const cellText = (row: ExcelJS.Row, col?: number): string =>
      col ? cellToText(row.getCell(col).value) : "";

    const existingContacts = await this.contactModel
      .find({ tenantId })
      .select("phone")
      .lean()
      .exec();
    const existingPhones = new Set(existingContacts.map((c) => c.phone));

    const toInsert: Partial<Contact>[] = [];
    const errors: { row: number; reason: string }[] = [];
    let skipped = 0;
    let totalRows = 0;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const isBlank =
        row.values == null || (row.values as unknown[]).length === 0;
      if (isBlank) return;
      totalRows++;

      const name = cellText(row, columnIndex.get("name"));
      const rawPhone = cellText(row, columnIndex.get("phone"));

      if (!name || !rawPhone) {
        errors.push({ row: rowNumber, reason: "Missing name or phone" });
        return;
      }

      const phone = normalizeImportPhone(rawPhone);
      if (!phone) {
        errors.push({ row: rowNumber, reason: `Invalid phone "${rawPhone}"` });
        return;
      }

      if (existingPhones.has(phone)) {
        skipped++;
        return;
      }
      existingPhones.add(phone); // guard against duplicate rows within the file itself

      const tagsRaw = cellText(row, columnIndex.get("tags"));

      toInsert.push({
        tenantId,
        name,
        phone,
        email: cellText(row, columnIndex.get("email")) || undefined,
        company: cellText(row, columnIndex.get("company")) || undefined,
        city: cellText(row, columnIndex.get("city")) || undefined,
        state: cellText(row, columnIndex.get("state")) || undefined,
        country: cellText(row, columnIndex.get("country")) || undefined,
        jobTitle: cellText(row, columnIndex.get("jobtitle")) || undefined,
        tags: tagsRaw
          ? tagsRaw
              .split(/[,;]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      });
    });

    if (toInsert.length > 0) {
      await this.contactModel.insertMany(toInsert, { ordered: false });
    }

    return {
      success: true,
      data: {
        totalRows,
        imported: toInsert.length,
        skipped,
        failed: errors.length,
        errors,
      },
    };
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
