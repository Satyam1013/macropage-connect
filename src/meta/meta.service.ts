import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios, { AxiosInstance } from "axios";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { EncryptionService } from "./encryption.service";

const BASE = "https://graph.facebook.com/v21.0";

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
    };
  }

  private handleMetaError(tenantId: string) {
    return async (err: unknown) => {
      if (axios.isAxiosError(err) && err.response?.data) {
        const code: number =
          (err.response.data as { error?: { code?: number } }).error?.code ?? 0;
        if (code === 190) {
          await this.wabaModel.updateOne({ tenantId }, { tokenExpired: true });
        }
      }
      throw err;
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
