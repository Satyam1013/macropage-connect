import {
  ConflictException,
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { HelpDoc, HelpDocDocument } from "../schemas/help-doc.schema";
import { HelpFaq, HelpFaqDocument } from "../schemas/help-faq.schema";
import {
  VideoTutorial,
  VideoTutorialDocument,
} from "../schemas/video-tutorial.schema";
import {
  SupportTicket,
  SupportTicketDocument,
} from "../schemas/support-ticket.schema";
import { DOC_ARTICLES, FAQ_ITEMS } from "./help.seed";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateVideoTutorialDto } from "./dto/create-video-tutorial.dto";
import { UpdateVideoTutorialDto } from "./dto/update-video-tutorial.dto";
import { CreateDocDto } from "./dto/create-doc.dto";
import { UpdateDocDto } from "./dto/update-doc.dto";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { QueryTicketsDto } from "./dto/query-tickets.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);

  constructor(
    @InjectModel(HelpDoc.name)
    private readonly docModel: Model<HelpDocDocument>,
    @InjectModel(HelpFaq.name)
    private readonly faqModel: Model<HelpFaqDocument>,
    @InjectModel(VideoTutorial.name)
    private readonly videoTutorialModel: Model<VideoTutorialDocument>,
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicketDocument>,
  ) {}

  async onModuleInit() {
    await this.seedData();
  }

  async seedData(force = false): Promise<{ docs: number; faqs: number }> {
    const docCount = await this.docModel.countDocuments();
    if (docCount === 0 || force) {
      await this.docModel.deleteMany({});
      await this.docModel.insertMany(DOC_ARTICLES);
      this.logger.log(`[Help] Seeded ${DOC_ARTICLES.length} doc articles`);
    }

    const faqCount = await this.faqModel.countDocuments();
    if (faqCount === 0 || force) {
      await this.faqModel.deleteMany({});
      await this.faqModel.insertMany(FAQ_ITEMS);
      this.logger.log(`[Help] Seeded ${FAQ_ITEMS.length} FAQ items`);
    }

    return {
      docs: await this.docModel.countDocuments(),
      faqs: await this.faqModel.countDocuments(),
    };
  }

  async getDocs(category?: string): Promise<HelpDocDocument[]> {
    const filter = category ? { category } : {};
    return this.docModel.find(filter).sort({ category: 1, order: 1 }).exec();
  }

  async getFaqs(category?: string): Promise<HelpFaqDocument[]> {
    const filter = category ? { category } : {};
    return this.faqModel.find(filter).sort({ category: 1, order: 1 }).exec();
  }

  // ── Platform-staff CRUD: docs ────────────────────────────────────────────

  async createDoc(dto: CreateDocDto) {
    const exists = await this.docModel.findOne({ slug: dto.slug }).exec();
    if (exists) {
      throw new ConflictException("A doc with this slug already exists");
    }
    return this.docModel.create(dto);
  }

  async updateDoc(id: string, dto: UpdateDocDto) {
    const doc = await this.docModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!doc) {
      throw new NotFoundException("Doc not found");
    }
    return doc;
  }

  async deleteDoc(id: string) {
    const doc = await this.docModel.findByIdAndDelete(id).exec();
    if (!doc) {
      throw new NotFoundException("Doc not found");
    }
    return doc;
  }

  // ── Platform-staff CRUD: FAQs ────────────────────────────────────────────

  createFaq(dto: CreateFaqDto) {
    return this.faqModel.create(dto);
  }

  async updateFaq(id: string, dto: UpdateFaqDto) {
    const faq = await this.faqModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!faq) {
      throw new NotFoundException("FAQ not found");
    }
    return faq;
  }

  async deleteFaq(id: string) {
    const faq = await this.faqModel.findByIdAndDelete(id).exec();
    if (!faq) {
      throw new NotFoundException("FAQ not found");
    }
    return faq;
  }

  async getVideoTutorials(): Promise<VideoTutorialDocument[]> {
    return this.videoTutorialModel.find().sort({ order: 1, createdAt: 1 }).exec();
  }

  createVideoTutorial(dto: CreateVideoTutorialDto) {
    return this.videoTutorialModel.create(dto);
  }

  async updateVideoTutorial(id: string, dto: UpdateVideoTutorialDto) {
    const video = await this.videoTutorialModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!video) {
      throw new NotFoundException("Video tutorial not found");
    }
    return video;
  }

  async deleteVideoTutorial(id: string) {
    const video = await this.videoTutorialModel.findByIdAndDelete(id).exec();
    if (!video) {
      throw new NotFoundException("Video tutorial not found");
    }
    return video;
  }

  async search(
    query: string,
  ): Promise<{ docs: HelpDocDocument[]; faqs: HelpFaqDocument[] }> {
    if (!query?.trim()) return { docs: [], faqs: [] };

    const [docs, faqs] = await Promise.all([
      this.docModel
        .find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .limit(5)
        .exec(),
      this.faqModel
        .find({ $text: { $search: query } }, { score: { $meta: "textScore" } })
        .sort({ score: { $meta: "textScore" } })
        .limit(5)
        .exec(),
    ]);

    return { docs, faqs };
  }

  async listTickets(tenantId: string, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 100)
        : 20;
    const [data, total] = await Promise.all([
      this.ticketModel
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .exec(),
      this.ticketModel.countDocuments({ tenantId }),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }

  async getSystemStatus(tenantId: string, page = 1, limit = 20) {
    const tickets = await this.listTickets(tenantId, page, limit);

    return {
      overall: "operational",
      services: [
        { name: "API", status: "operational" },
        { name: "WhatsApp Gateway", status: "operational" },
        { name: "Database", status: "operational" },
      ],
      incidents: [],
      updatedAt: new Date().toISOString(),
      tickets,
    };
  }

  async getTicketById(
    tenantId: string,
    id: string,
  ): Promise<SupportTicketDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Ticket not found");
    }
    const ticket = await this.ticketModel.findOne({ _id: id, tenantId }).exec();
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async createTicket(
    tenantId: string,
    user: { id: string; name: string; email: string },
    dto: CreateTicketDto,
  ) {
    const ticket = await this.ticketModel.create({
      tenantId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      subject: dto.subject,
      description: dto.description,
      category: dto.category ?? "other",
      priority: dto.priority ?? "medium",
      attachments: dto.attachments ?? [],
    });
    return { success: true, data: ticket };
  }

  // ── Platform-staff triage (cross-tenant) ─────────────────────────────────

  async findAllTicketsForPlatform(query: QueryTicketsDto) {
    const { page = 1, limit = 20, status, priority, tenantId } = query;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (tenantId) filter.tenantId = tenantId;

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.ticketModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneTicketForPlatform(id: string): Promise<SupportTicketDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Ticket not found");
    }
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async updateTicketStatus(id: string, dto: UpdateTicketDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException("Ticket not found");
    }
    const ticket = await this.ticketModel
      .findByIdAndUpdate(
        id,
        { $set: { status: dto.status } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }
}
