import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { HelpDoc, HelpDocDocument } from "../schemas/help-doc.schema";
import { HelpFaq, HelpFaqDocument } from "../schemas/help-faq.schema";
import { DOC_ARTICLES, FAQ_ITEMS } from "./help.seed";

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);

  constructor(
    @InjectModel(HelpDoc.name)
    private readonly docModel: Model<HelpDocDocument>,
    @InjectModel(HelpFaq.name)
    private readonly faqModel: Model<HelpFaqDocument>,
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

  getSystemStatus() {
    return {
      overall: "operational",
      services: [
        { name: "API", status: "operational" },
        { name: "WhatsApp Gateway", status: "operational" },
        { name: "Database", status: "operational" },
      ],
      incidents: [],
      updatedAt: new Date().toISOString(),
    };
  }
}
