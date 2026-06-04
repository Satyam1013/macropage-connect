import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { EncryptionService } from "../meta/encryption.service";

const BASE = "https://graph.facebook.com/v21.0";

export class ConnectMetaDto {
  code!: string;
  wabaId?: string;
  phoneNumberId?: string;
}

export class VerifyPhoneDto {
  phoneNumberId!: string;
  method!: "SMS" | "VOICE";
}

export class ConfirmPhoneDto {
  phoneNumberId!: string;
  code!: string;
}

@Injectable()
export class WhatsappService {
  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async getStatus(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    return {
      metaConnected: waba?.metaConnected ?? false,
      phoneNumber: waba?.phoneNumber,
      displayName: waba?.displayName,
      qualityRating: waba?.qualityRating,
      tokenExpired: waba?.tokenExpired ?? false,
    };
  }

  async connectMeta(
    tenantId: string,
    dto: ConnectMetaDto,
  ): Promise<WABAAccountDocument> {
    const shortResp = await axios.get(`${BASE}/oauth/access_token`, {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        code: dto.code,
      },
    });
    const shortToken = (shortResp.data as { access_token: string })
      .access_token;

    const longResp = await axios.get(`${BASE}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortToken,
      },
    });
    const longToken = (longResp.data as { access_token: string }).access_token;

    let wabaId = dto.wabaId;
    if (!wabaId) {
      const bizResp = await axios.get(`${BASE}/me/businesses`, {
        params: {
          fields: "id,name,whatsapp_business_accounts",
          access_token: longToken,
        },
      });
      const biz = (
        bizResp.data as {
          data?: Array<{
            whatsapp_business_accounts?: { data?: Array<{ id: string }> };
          }>;
        }
      ).data?.[0];
      wabaId = biz?.whatsapp_business_accounts?.data?.[0]?.id;
    }
    if (!wabaId) throw new BadRequestException("Could not determine WABA ID");

    const phonesResp = await axios.get(`${BASE}/${wabaId}/phone_numbers`, {
      params: {
        fields:
          "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier",
        access_token: longToken,
      },
    });
    const phones =
      (
        phonesResp.data as {
          data?: Array<{
            id: string;
            display_phone_number: string;
            verified_name: string;
            quality_rating: string;
            messaging_limit_tier: string;
          }>;
        }
      ).data ?? [];
    const phone = phones[0];
    if (!phone) throw new BadRequestException("No phone numbers found in WABA");

    await axios.post(
      `${BASE}/${wabaId}/subscribed_apps`,
      {},
      { params: { access_token: longToken } },
    );

    const encrypted = this.encryption.encrypt(longToken);

    return this.wabaModel
      .findOneAndUpdate(
        { tenantId },
        {
          tenantId,
          wabaId,
          phoneNumberId: dto.phoneNumberId ?? phone.id,
          phoneNumber: phone.display_phone_number,
          displayName: phone.verified_name,
          accessToken: encrypted,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          metaConnected: true,
          qualityRating: phone.quality_rating ?? "GREEN",
          messagingTier: phone.messaging_limit_tier ?? "TIER_1K",
          tokenExpired: false,
          connectedAt: new Date(),
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async requestVerificationCode(
    tenantId: string,
    dto: VerifyPhoneDto,
  ): Promise<void> {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) throw new BadRequestException("WhatsApp not connected");
    const token = this.encryption.decrypt(waba.accessToken);

    await axios.post(
      `${BASE}/${dto.phoneNumberId}/request_code`,
      { code_method: dto.method, language: "en_US" },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  async confirmVerificationCode(
    tenantId: string,
    dto: ConfirmPhoneDto,
  ): Promise<void> {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) throw new BadRequestException("WhatsApp not connected");
    const token = this.encryption.decrypt(waba.accessToken);

    await axios.post(
      `${BASE}/${dto.phoneNumberId}/verify_code`,
      { code: dto.code },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  async disconnect(tenantId: string): Promise<void> {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) return;
    const token = this.encryption.decrypt(waba.accessToken);
    await axios
      .delete(`${BASE}/${waba.wabaId}/subscribed_apps`, {
        params: { access_token: token },
      })
      .catch(() => null);
    await this.wabaModel.deleteOne({ tenantId });
  }
}
