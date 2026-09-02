import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(TemplatesService.name);

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

  private async buildComponents(
    tenantId: string,
    dto: Partial<CreateTemplateDto> & Pick<CreateTemplateDto, "body">,
  ): Promise<Record<string, unknown>[]> {
    const components: Record<string, unknown>[] = [];
    if (dto.header) {
      const header = dto.header as Record<string, unknown> & {
        format?: string;
        mediaUrl?: string;
      };
      // Meta doesn't accept a raw mediaUrl on the component — media
      // headers need the file uploaded through Meta's Resumable Upload
      // API first, exchanged for a "handle" referenced in the example.
      if (
        header.format &&
        header.format !== "TEXT" &&
        typeof header.mediaUrl === "string"
      ) {
        const handle = await this.metaService.uploadMediaHandleFromUrl(
          tenantId,
          header.mediaUrl,
        );
        components.push({
          type: "HEADER",
          format: header.format,
          example: { header_handle: [handle] },
        });
      } else {
        components.push({ type: "HEADER", ...header });
      }
    }

    if (dto.category === "AUTHENTICATION") {
      // Meta doesn't support a custom `text` property for AUTHENTICATION
      // templates at all — the body is a fixed, non-customizable preset
      // ("{{1}} is your verification code.") and only one variable (the
      // code itself) is allowed. Sending dto.body as `text` here (like
      // every other category) gets rejected with "component of type BODY
      // has unexpected field(s) (text)".
      components.push({ type: "BODY", add_security_recommendation: true });

      // FOOTER for authentication templates is code_expiration_minutes,
      // not free text — only add it if dto.footer is a clean integer;
      // otherwise Meta's FOOTER is optional here, so just omit it.
      const expirationMinutes = Number(dto.footer);
      if (dto.footer && Number.isInteger(expirationMinutes)) {
        components.push({
          type: "FOOTER",
          code_expiration_minutes: expirationMinutes,
        });
      }

      // BUTTONS is required for authentication templates — default to the
      // standard OTP copy-code button when the caller didn't provide one.
      components.push(
        dto.buttons ?? {
          type: "BUTTONS",
          buttons: [{ type: "OTP", otp_type: "COPY_CODE" }],
        },
      );

      return components;
    }

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

    return components;
  }

  private throwMetaTemplateError(
    err: unknown,
    components: Record<string, unknown>[],
  ): never {
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
    throw err as Error;
  }

  async create(
    tenantId: string,
    dto: CreateTemplateDto,
  ): Promise<TemplateDocument> {
    const client = await this.metaService.getClient(tenantId);
    const components = await this.buildComponents(tenantId, dto);

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
      this.throwMetaTemplateError(err, components);
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

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateTemplateDto>,
  ): Promise<TemplateDocument> {
    const t = await this.findOne(tenantId, id);

    // Never-submitted drafts: just save locally, same as updateDraft.
    if (!t.metaTemplateId) {
      Object.assign(t, dto);
      return t.save();
    }

    // Already-submitted templates: Meta's edit API can't change name or
    // language, only content/category — those two are ignored here even
    // if sent. Editing content sends it back for re-review.
    const body = dto.body ?? t.body;
    const header = dto.header ?? t.header;
    const footer = dto.footer ?? t.footer;
    const buttons = dto.buttons ?? t.buttons;
    const sampleVariables = dto.sampleVariables ?? t.sampleVariables;
    const category =
      (dto.category as TemplateCategory | undefined) ?? t.category;

    const components = await this.buildComponents(tenantId, {
      body,
      header,
      footer,
      buttons,
      sampleVariables,
      category,
    });

    const client = await this.metaService.getClient(tenantId);
    try {
      await client.editTemplate(t.metaTemplateId, { category, components });
    } catch (err) {
      this.throwMetaTemplateError(err, components);
    }

    t.body = body;
    t.header = header;
    t.footer = footer;
    t.buttons = buttons;
    t.sampleVariables = sampleVariables;
    t.category = category;
    t.status = "PENDING";
    t.rejectionReason = undefined;
    return t.save();
  }

  async syncFromMeta(tenantId: string): Promise<{ updated: number }> {
    const client = await this.metaService.getClient(tenantId);
    const resp = await client.getTemplates();
    const templates =
      (resp.data as { data?: Record<string, unknown>[] }).data ?? [];

    let updated = 0;
    for (const t of templates) {
      const components =
        (t["components"] as Array<Record<string, unknown>> | undefined) ?? [];
      const bodyComp = components.find((c) => c["type"] === "BODY");
      const headerComp = components.find((c) => c["type"] === "HEADER");
      const footerComp = components.find((c) => c["type"] === "FOOTER");
      const buttonsComp = components.find((c) => c["type"] === "BUTTONS");

      // `body` is a required schema field, but AUTHENTICATION templates
      // have no `text` on their BODY component at all (Meta's fixed
      // preset) — without a fallback, the upsert fails schema validation
      // for any template that only exists on Meta (e.g. one created
      // directly in Meta's own WhatsApp Manager, never through our own
      // create()/update()), silently breaking sync for it.
      const body =
        (bodyComp?.["text"] as string | undefined) ??
        "{{1}} is your verification code.";

      const setFields: Record<string, unknown> = {
        status: t["status"],
        category: t["category"],
        metaTemplateId: t["id"],
        body,
      };
      if (headerComp) setFields.header = headerComp;
      if (buttonsComp) setFields.buttons = buttonsComp;
      const footerText = footerComp?.["text"];
      if (typeof footerText === "string" && footerText) {
        setFields.footer = footerText;
      }

      try {
        await this.templateModel.findOneAndUpdate(
          {
            tenantId,
            name: t["name"] as string,
            language: t["language"] as string,
          },
          { $set: setFields },
          { upsert: true },
        );
        updated++;
      } catch (err) {
        // One malformed/unexpected template from Meta shouldn't break
        // sync for the rest.
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[syncFromMeta] Failed to upsert template ${String(t["name"])} for tenant ${tenantId}: ${message}`,
        );
      }
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
