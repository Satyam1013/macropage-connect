import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import axios from "axios";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Template, TemplateDocument } from "../schemas/template.schema";
import type { TemplateCategory } from "./templates.types";
import { MetaService } from "../meta/meta.service";
import { CreateTemplateDto } from "./dto/create-template.dto";

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly metaService: MetaService,
  ) {}

  async findAll(tenantId: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    return this.templateModel.find(where).sort({ createdAt: -1 }).exec();
  }

  async findOne(tenantId: string, id: string): Promise<TemplateDocument> {
    const t = await this.templateModel.findOne({ _id: id, tenantId }).exec();
    if (!t) throw new NotFoundException("Template not found");
    return t;
  }

  async create(
    tenantId: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateDocument> {
    const client = await this.metaService.getClient(tenantId);

    const components: Record<string, unknown>[] = [];
    if (dto.header) components.push({ type: "HEADER", ...dto.header });
    components.push({
      type: "BODY",
      text: dto.body,
      ...(dto.sampleVariables
        ? { example: { body_text: [Object.values(dto.sampleVariables)] } }
        : {}),
    });
    if (dto.footer) components.push({ type: "FOOTER", text: dto.footer });
    if (dto.buttons)
      components.push({ type: "BUTTONS", ...(dto.buttons as object) });

    let metaId: string | undefined;
    try {
      const metaResp = await client.createTemplate({
        name: dto.name,
        category: dto.category,
        language: dto.language,
        components,
      });
      metaId = (metaResp.data as { id?: string }).id;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const metaMsg = (err.response?.data as { error?: { message?: string } })
          ?.error?.message;
        throw new BadRequestException(metaMsg ?? "Meta rejected the template");
      }
      throw err;
    }

    return this.templateModel.create({
      ...dto,
      category: dto.category as TemplateCategory,
      tenantId,
      metaTemplateId: metaId,
      status: "PENDING" as const,
    });
  }

  async syncFromMeta(tenantId: string): Promise<{ updated: number }> {
    const client = await this.metaService.getClient(tenantId);
    const resp = await client.getTemplates();
    const templates =
      (resp.data as { data?: Record<string, unknown>[] }).data ?? [];

    let updated = 0;
    for (const t of templates) {
      await this.templateModel.findOneAndUpdate(
        { tenantId, metaTemplateId: t["id"] as string },
        {
          name: t["name"],
          status: t["status"],
          category: t["category"],
          metaTemplateId: t["id"],
          tenantId,
        },
        { upsert: true, new: true },
      );
      updated++;
    }
    return { updated };
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const t = await this.findOne(tenantId, id);
    if (t.metaTemplateId) {
      const client = await this.metaService.getClient(tenantId);
      await client.deleteTemplate(t.metaTemplateId).catch(() => null);
    }
    await this.templateModel.deleteOne({ _id: id, tenantId });
  }
}
