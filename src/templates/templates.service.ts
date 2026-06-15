import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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

    const bodyComp: Record<string, unknown> = { type: "BODY", text: dto.body };
    const bodyHasVars = /\{\{\d+\}\}/.test(dto.body);
    if (bodyHasVars) {
      const values = Object.values(dto.sampleVariables ?? {}).filter(
        (v) => typeof v === "string" && v.trim().length > 0,
      );
      if (values.length > 0) {
        bodyComp.example = { body_text: [values] };
      } else {
        const varCount = (dto.body.match(/\{\{\d+\}\}/g) ?? []).length;
        bodyComp.example = {
          body_text: [
            Array.from({ length: varCount }, (_, i) => `example${i + 1}`),
          ],
        };
      }
    }
    components.push(bodyComp);

    if (dto.footer) components.push({ type: "FOOTER", text: dto.footer });
    if (dto.buttons) {
      const { buttons: btnList, ...btnRest } = dto.buttons as {
        buttons?: unknown[];
        [k: string]: unknown;
      };
      components.push({
        type: "BUTTONS",
        buttons: btnList,
        ...btnRest,
      });
    }

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
        const metaError = err.response?.data as {
          error?: {
            message?: string;
            error_user_title?: string;
            error_user_msg?: string;
            error_data?: unknown;
          };
        };
        const detail =
          metaError?.error?.error_user_msg ??
          metaError?.error?.error_user_title ??
          metaError?.error?.message ??
          "Meta rejected the template";
        throw new BadRequestException({
          success: false,
          error: {
            code: "META_TEMPLATE_ERROR",
            message: detail,
            meta: metaError?.error,
            sentComponents: components,
          },
        });
      }
      throw err;
    }

    try {
      return await this.templateModel.create({
        ...dto,
        category: dto.category as TemplateCategory,
        tenantId,
        metaTemplateId: metaId,
        status: "PENDING" as const,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({
          success: false,
          error: {
            code: "DUPLICATE_TEMPLATE",
            message: `A template named "${dto.name}" in "${dto.language}" already exists`,
          },
        });
      }
      throw err;
    }
  }

  async saveDraft(
    tenantId: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateDocument> {
    try {
      return await this.templateModel.create({
        ...dto,
        category: dto.category as TemplateCategory,
        tenantId,
        status: "DRAFT" as const,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictException({
          success: false,
          error: {
            code: "DUPLICATE_TEMPLATE",
            message: `A template named "${dto.name}" in "${dto.language}" already exists`,
          },
        });
      }
      throw err;
    }
  }

  async updateDraft(
    tenantId: string,
    id: string,
    dto: Partial<CreateTemplateDto>,
  ): Promise<TemplateDocument> {
    const t = await this.templateModel
      .findOne({ _id: id, tenantId, status: "DRAFT" })
      .exec();
    if (!t) throw new NotFoundException("Draft template not found");
    Object.assign(t, dto);
    return t.save();
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
        { returnDocument: "after", upsert: true },
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
