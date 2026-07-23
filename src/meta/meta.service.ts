import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios, { AxiosInstance } from "axios";
import { META_GRAPH_BASE as BASE } from "./meta.constants";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { EncryptionService } from "./encryption.service";

@Injectable()
export class MetaService {
  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async getClient(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) throw new BadRequestException("WhatsApp account not connected");
    if (waba.tokenExpired)
      throw new BadRequestException("WhatsApp token expired");

    const token = this.encryption.decrypt(waba.accessToken);
    const { phoneNumberId, wabaId } = waba;

    if (!phoneNumberId) {
      this.logger.error(
        `[Meta] phoneNumberId is missing for tenant ${tenantId} — wabaId=${wabaId ?? "none"}`,
      );
      throw new BadRequestException(
        "WhatsApp phone number ID not configured. Please reconnect your WhatsApp account.",
      );
    }

    this.logger.debug(
      `[Meta] getClient tenant=${tenantId} phoneNumberId=${phoneNumberId} wabaId=${wabaId}`,
    );

    const headers = { Authorization: `Bearer ${token}` };
    const http: AxiosInstance = axios.create({ baseURL: BASE, headers });

    return {
      phoneNumberId,
      wabaId,
      sendMessage: (payload: Record<string, unknown>) =>
        http
          .post(`/${phoneNumberId}/messages`, payload)
          .catch(this.handleMetaError(tenantId)),
      createTemplate: (template: Record<string, unknown>) =>
        http.post(`/${wabaId}/message_templates`, template),
      getTemplates: () =>
        http.get(`/${wabaId}/message_templates`, {
          params: {
            fields: "id,name,status,category,language,components",
            limit: 100,
          },
        }),
      getPhoneNumbers: () =>
        http.get(`/${wabaId}/phone_numbers`, {
          params: {
            fields:
              "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier",
          },
        }),
      deleteTemplate: (metaTemplateId: string) =>
        http.delete(`/${metaTemplateId}`),
      editTemplate: (
        metaTemplateId: string,
        template: Record<string, unknown>,
      ) => http.post(`/${metaTemplateId}`, template),
    };
  }

  async getAccessToken(tenantId: string): Promise<string> {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) throw new BadRequestException("WhatsApp account not connected");
    if (waba.tokenExpired)
      throw new BadRequestException("WhatsApp token expired");
    return this.encryption.decrypt(waba.accessToken);
  }

  private readonly logger = new Logger(MetaService.name);

  private handleMetaError(tenantId: string) {
    return async (err: unknown) => {
      if (!axios.isAxiosError(err)) throw err;

      const metaError = err.response?.data as {
        error?: {
          message?: string;
          code?: number;
          error_subcode?: number;
          error_user_title?: string;
          error_user_msg?: string;
        };
      };

      const code = metaError?.error?.code ?? 0;
      const message =
        metaError?.error?.error_user_msg ??
        metaError?.error?.error_user_title ??
        metaError?.error?.message ??
        `Meta API error (HTTP ${err.response?.status ?? "unknown"})`;

      this.logger.error(`Meta API error [${code}]: ${message}`);

      if (code === 190) {
        await this.wabaModel.updateOne({ tenantId }, { tokenExpired: true });
        throw new BadRequestException({
          success: false,
          error: {
            code: "WHATSAPP_TOKEN_EXPIRED",
            message: "WhatsApp token expired. Please reconnect.",
          },
        });
      }

      if (code === 133010) {
        throw new BadRequestException({
          success: false,
          error: {
            code: "NOT_ON_WHATSAPP",
            message:
              "This phone number is not registered on WhatsApp. Please update the contact's phone number.",
          },
        });
      }

      throw new BadRequestException({
        success: false,
        error: { code: "META_SEND_FAIL", message },
      });
    };
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const shortResp = await axios.get<{ access_token: string }>(
      `${BASE}/oauth/access_token`,
      {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          code,
        },
      },
    );
    const short = shortResp.data.access_token;

    const longResp = await axios.get<{ access_token: string }>(
      `${BASE}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: short,
        },
      },
    );
    return longResp.data.access_token;
  }
}
