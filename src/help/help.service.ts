import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HelpDoc, HelpDocDocument } from "../schemas/help-doc.schema";
import { HelpFaq, HelpFaqDocument } from "../schemas/help-faq.schema";
import {
  SupportTicket,
  SupportTicketDocument,
} from "../schemas/support-ticket.schema";
import { DOC_ARTICLES, FAQ_ITEMS } from "./help.seed";
import { CreateTicketDto } from "./dto/create-ticket.dto";

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);

  constructor(
    @InjectModel(HelpDoc.name)
    private readonly docModel: Model<HelpDocDocument>,
    @InjectModel(HelpFaq.name)
    private readonly faqModel: Model<HelpFaqDocument>,
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

  async getSystemStatus(tenantId: string, page = 1, limit = 20) {
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

    return {
      overall: "operational",
      services: [
        { name: "API", status: "operational" },
        { name: "WhatsApp Gateway", status: "operational" },
        { name: "Database", status: "operational" },
      ],
      incidents: [],
      updatedAt: new Date().toISOString(),
      tickets: { data, total, page: safePage, limit: safeLimit },
    };
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
}
