import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import ExcelJS from "exceljs";
import axios from "axios";
import * as fastcsv from "fast-csv";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  ContactSegment,
  ContactSegmentDocument,
} from "../schemas/contact-segment.schema";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import type { ContactFilters } from "./contacts.types";

const IMPORT_FIELDS = [
  "name",
  "phone",
  "email",
  "company",
  "city",
  "state",
  "country",
  "jobTitle",
  "tags",
] as const;
type ImportField = (typeof IMPORT_FIELDS)[number];

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

function parseCsvRows(buffer: Buffer): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    fastcsv
      .parseString(buffer.toString("utf-8"), {
        headers: true,
        trim: true,
        ignoreEmpty: true,
      })
      .on("data", (row: Record<string, string>) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", (err: Error) =>
        reject(
          new BadRequestException(`Could not read CSV file: ${err.message}`),
        ),
      );
  });
}

async function parseXlsxRows(
  buffer: Buffer,
): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException(
      "Could not read file — please upload a valid .xlsx file",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException("The uploaded file has no sheets");

  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cellToText(cell.value);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const isBlank =
      row.values == null || (row.values as unknown[]).length === 0;
    if (isBlank) return;

    const obj: Record<string, string> = {};
    headers.forEach((header, colNumber) => {
      if (!header) return;
      obj[header] = cellToText(row.getCell(colNumber).value);
    });
    rows.push(obj);
  });
  return rows;
}

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(ContactSegment.name)
    private readonly segmentModel: Model<ContactSegmentDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
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

  // A custom segment's membership is the union of its dynamic `filters`
  // match and its manually-assigned `contactIds` — not just one or the
  // other. Shared by the count in buildCustomSegmentView() and the actual
  // member listing in getSegmentContacts() so they can't disagree.
  private buildSegmentWhere(
    tenantId: string,
    segment: Pick<ContactSegmentDocument, "filters" | "contactIds">,
  ): Record<string, unknown> {
    const filterWhere = this.buildWhere(tenantId, segment.filters);
    return segment.contactIds.length > 0
      ? { $or: [filterWhere, { tenantId, _id: { $in: segment.contactIds } }] }
      : filterWhere;
  }

  private async buildCustomSegmentView(
    tenantId: string,
    segment: ContactSegmentDocument,
  ) {
    const where = this.buildSegmentWhere(tenantId, segment);
    return {
      id: String(segment._id),
      name: segment.name,
      color: segment.color,
      filters: segment.filters,
      contactIds: segment.contactIds.map(String),
      count: await this.contactModel.countDocuments(where),
      type: "custom" as const,
    };
  }

  // The actual member contacts of a segment (paginated) — GET
  // /contacts/segments only returns counts for the sidebar, this is what
  // backs "show me who's actually in this segment."
  async getSegmentContacts(
    tenantId: string,
    segmentId: string,
    filters: { page?: number; limit?: number } = {},
  ) {
    const segment = await this.segmentModel
      .findOne({ _id: segmentId, tenantId })
      .exec();
    if (!segment) throw new NotFoundException("Segment not found");

    const { page = 1, limit = 20 } = filters;
    const where = this.buildSegmentWhere(tenantId, segment);

    const [data, total] = await Promise.all([
      this.contactModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.contactModel.countDocuments(where),
    ]);

    return { success: true, data: { data, total, page, limit } };
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
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Contact not found");
    }
    const contact = await this.contactModel
      .findOne({ _id: id, tenantId })
      .exec();
    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async getDetails(tenantId: string, id: string) {
    const contact = await this.findOne(tenantId, id);
    const recipients = await this.recipientModel
      .find({ contactId: id })
      .sort({ sentAt: -1, _id: -1 })
      .lean()
      .exec();

    const campaignIds = recipients
      .map((recipient) => recipient.campaignId)
      .filter((campaignId) => Types.ObjectId.isValid(campaignId));
    const campaigns = await this.campaignModel
      .find({ _id: { $in: campaignIds }, tenantId })
      .select("name status startedAt completedAt")
      .lean()
      .exec();
    const campaignsById = new Map(
      campaigns.map((campaign) => [String(campaign._id), campaign]),
    );

    // Recipient records are the source of truth. Calculating totals from
    // them also repairs legacy contacts whose denormalized counters were
    // never incremented during campaign sending.
    const campaignHistory = recipients.flatMap((recipient) => {
      const campaign = campaignsById.get(recipient.campaignId);
      if (!campaign) return [];
      return [
        {
          campaignId: recipient.campaignId,
          campaignName: campaign.name,
          campaignStatus: campaign.status,
          recipientStatus: recipient.status,
          sentAt: recipient.sentAt ?? null,
          deliveredAt: recipient.deliveredAt ?? null,
          readAt: recipient.readAt ?? null,
          failedAt: recipient.failedAt ?? null,
          failureReason: recipient.failureReason ?? null,
        },
      ];
    });
    const totalCampaigns = new Set(
      campaignHistory.map((item) => item.campaignId),
    ).size;
    const totalMessages = campaignHistory.filter((item) =>
      ["sent", "delivered", "read"].includes(item.recipientStatus),
    ).length;

    return {
      ...contact.toObject(),
      totalCampaigns,
      totalMessages,
      campaignHistory,
    };
  }

  async getTags(tenantId: string) {
    const agg = await this.contactModel.aggregate<{
      _id: string;
      count: number;
    }>([
      { $match: { tenantId, tags: { $exists: true, $ne: [] } } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      success: true,
      data: { tags: agg.map((t) => ({ tag: t._id, count: t.count })) },
    };
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

  async bulkDelete(
    tenantId: string,
    ids: string[],
  ): Promise<{ deletedCount: number }> {
    const result = await this.contactModel
      .deleteMany({ _id: { $in: ids }, tenantId })
      .exec();
    return { deletedCount: result.deletedCount ?? 0 };
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
      customSegments.map((s) => this.buildCustomSegmentView(tenantId, s)),
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

  // Unknown/foreign-tenant IDs are silently dropped rather than rejected —
  // same behavior as bulkTag()'s $in filter — but the count of how many
  // were skipped is returned so the caller can tell.
  async assignContactsToSegment(
    tenantId: string,
    segmentId: string,
    contactIds: string[],
  ) {
    const segment = await this.segmentModel
      .findOne({ _id: segmentId, tenantId })
      .exec();
    if (!segment) throw new NotFoundException("Segment not found");

    const validContacts = await this.contactModel
      .find({ _id: { $in: contactIds }, tenantId })
      .select("_id")
      .lean()
      .exec();
    const skipped = contactIds.length - validContacts.length;

    const merged = new Map(
      [...segment.contactIds, ...validContacts.map((c) => c._id)].map((id) => [
        String(id),
        id,
      ]),
    );
    segment.contactIds = Array.from(merged.values());
    await segment.save();

    const view = await this.buildCustomSegmentView(tenantId, segment);
    return { success: true, data: { ...view, skipped } };
  }

  // fileUrl must point at our own DO Spaces bucket — this endpoint has the
  // server fetch a client-supplied URL, so an unrestricted host would be SSRF.
  /** Throws 400 unless fileUrl is an http(s) URL on our DO Spaces bucket. */
  assertImportFileUrl(fileUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      throw new BadRequestException("Invalid fileUrl");
    }
    if (!parsed.hostname.endsWith(".digitaloceanspaces.com")) {
      throw new BadRequestException(
        "fileUrl must point to a DigitalOcean Spaces file",
      );
    }
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.endsWith(".csv") && !pathname.endsWith(".xlsx")) {
      throw new BadRequestException(
        "Unsupported file type — fileUrl must be a .xlsx or .csv file",
      );
    }
  }

  private async downloadImportFile(fileUrl: string): Promise<Buffer> {
    this.assertImportFileUrl(fileUrl);
    try {
      const resp = await axios.get<ArrayBuffer>(fileUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        // Matches the 10 MB limit the upload UI advertises.
        maxContentLength: 10 * 1024 * 1024,
      });
      return Buffer.from(resp.data);
    } catch {
      throw new BadRequestException("Could not download file from fileUrl");
    }
  }

  /**
   * Downloads and parses an import file into contact rows, in file order
   * (duplicates included — callers decide how to treat them). Shared by
   * contact import and CSV campaign audiences so both apply the same
   * column mapping and phone normalization.
   */
  private async readImportRows(
    tenantId: string,
    fileUrl: string,
    columnMapping: Record<string, string> | undefined,
    { requireName }: { requireName: boolean },
  ) {
    const buffer = await this.downloadImportFile(fileUrl);
    const pathname = new URL(fileUrl).pathname.toLowerCase();
    const rawRows = pathname.endsWith(".csv")
      ? await parseCsvRows(buffer)
      : await parseXlsxRows(buffer);

    const mapping = Object.fromEntries(
      IMPORT_FIELDS.map((field) => [field, columnMapping?.[field] ?? field]),
    ) as Record<ImportField, string>;

    const getField = (row: Record<string, string>, field: ImportField) =>
      (row[mapping[field]] ?? "").toString().trim();

    const rows: { phone: string; data: Partial<Contact> }[] = [];
    const errors: { row: number; reason: string }[] = [];

    rawRows.forEach((row, i) => {
      const rowNumber = i + 2; // +1 for header row, +1 for 1-indexing
      const name = getField(row, "name");
      const rawPhone = getField(row, "phone");

      if (!rawPhone || (requireName && !name)) {
        errors.push({
          row: rowNumber,
          reason: requireName ? "Missing name or phone" : "Missing phone",
        });
        return;
      }

      const phone = normalizeImportPhone(rawPhone);
      if (!phone) {
        errors.push({ row: rowNumber, reason: `Invalid phone "${rawPhone}"` });
        return;
      }

      const tagsRaw = getField(row, "tags");
      rows.push({
        phone,
        data: {
          tenantId,
          name: name || phone,
          phone,
          email: getField(row, "email") || undefined,
          company: getField(row, "company") || undefined,
          city: getField(row, "city") || undefined,
          state: getField(row, "state") || undefined,
          country: getField(row, "country") || undefined,
          jobTitle: getField(row, "jobTitle") || undefined,
          tags: tagsRaw
            ? tagsRaw
                .split(/[,;]/)
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        },
      });
    });

    return { totalRows: rawRows.length, rows, errors };
  }

  async importContacts(
    tenantId: string,
    fileUrl: string,
    columnMapping?: Record<string, string>,
    duplicateHandling: "skip" | "update" = "skip",
  ) {
    const { totalRows, rows, errors } = await this.readImportRows(
      tenantId,
      fileUrl,
      columnMapping,
      { requireName: true },
    );

    const existingPhones = new Set(
      (
        await this.contactModel.find({ tenantId }).select("phone").lean().exec()
      ).map((c) => c.phone),
    );

    const toInsert: Partial<Contact>[] = [];
    const toUpdate: { phone: string; data: Partial<Contact> }[] = [];
    const seenInFile = new Set<string>();
    let skipped = 0;

    for (const { phone, data } of rows) {
      const isExisting = existingPhones.has(phone);
      const isDupInFile = seenInFile.has(phone);
      seenInFile.add(phone);

      if (isExisting || isDupInFile) {
        if (duplicateHandling === "update" && isExisting && !isDupInFile) {
          toUpdate.push({ phone, data });
        } else {
          skipped++;
        }
        continue;
      }
      toInsert.push(data);
    }

    if (toInsert.length > 0) {
      await this.contactModel.insertMany(toInsert, { ordered: false });
    }
    for (const { phone, data } of toUpdate) {
      await this.contactModel.updateOne({ tenantId, phone }, { $set: data });
    }

    return {
      success: true,
      data: {
        totalRows,
        imported: toInsert.length,
        updated: toUpdate.length,
        skipped,
        failed: errors.length,
        errors,
      },
    };
  }

  /**
   * Resolves a CSV campaign audience: every valid number in the file,
   * de-duplicated. Numbers not yet in contacts are added (name falls back
   * to the number); existing contacts are left untouched. Opted-out
   * contacts are excluded, as for every campaign.
   */
  async prepareCsvAudience(
    tenantId: string,
    fileUrl: string,
    columnMapping?: Record<string, string>,
  ) {
    const { totalRows, rows, errors } = await this.readImportRows(
      tenantId,
      fileUrl,
      columnMapping,
      { requireName: false },
    );

    const byPhone = new Map<string, Partial<Contact>>();
    for (const { phone, data } of rows) {
      if (!byPhone.has(phone)) byPhone.set(phone, data);
    }
    const phones = [...byPhone.keys()];

    const existing = new Set(
      (
        await this.contactModel
          .find({ tenantId, phone: { $in: phones } })
          .select("phone")
          .lean()
          .exec()
      ).map((c) => c.phone),
    );
    const toInsert = phones
      .filter((phone) => !existing.has(phone))
      .map((phone) => byPhone.get(phone)!);
    if (toInsert.length > 0) {
      try {
        await this.contactModel.insertMany(toInsert, { ordered: false });
      } catch (err) {
        // A concurrent insert of the same number (unique tenantId+phone)
        // is fine — the contact exists either way.
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }

    const contacts = await this.contactModel
      .find({ tenantId, phone: { $in: phones }, isOptedOut: { $ne: true } })
      .select("_id phone")
      .lean()
      .exec();

    return {
      contacts: contacts.map((c) => ({ id: String(c._id), phone: c.phone })),
      stats: {
        totalRows,
        invalid: errors.length,
        duplicatesInFile: rows.length - phones.length,
        optedOut: phones.length - contacts.length,
        newContacts: toInsert.length,
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
