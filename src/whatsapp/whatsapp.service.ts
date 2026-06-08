import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { EncryptionService } from "../meta/encryption.service";
import {
  BusinessInfoDto,
  ConnectMetaDto,
  VerifyPhoneDto,
  ConfirmPhoneDto,
} from "./dto/whatsapp.dto";

const BASE = "https://graph.facebook.com/v21.0";

@Injectable()
export class WhatsappService {
  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly encryption: EncryptionService,
  ) {}

  async getStatus(tenantId: string) {
    const [user, waba] = await Promise.all([
      this.userModel.findById(tenantId).exec(),
      this.wabaModel.findOne({ tenantId }).exec(),
    ]);

    const businessInfoSaved = user?.businessInfoSaved ?? false;
    const metaConnected = waba?.metaConnected ?? false;
    const phoneVerified = waba?.phoneVerified ?? false;
    const testMessageSent = waba?.testMessageSent ?? false;

    let currentStep: number;
    if (!businessInfoSaved) currentStep = 1;
    else if (!metaConnected) currentStep = 2;
    else if (!phoneVerified) currentStep = 3;
    else if (!testMessageSent) currentStep = 4;
    else currentStep = 5;

    return {
      success: true,
      data: {
        currentStep,
        businessInfoSaved,
        metaConnected,
        phoneVerified,
        testMessageSent,
        setupComplete: currentStep === 5,
        tokenExpired: waba?.tokenExpired ?? false,
        wabaAccount:
          waba && metaConnected
            ? {
                wabaId: waba.wabaId,
                phoneNumberId: waba.phoneNumberId,
                phoneNumber: waba.phoneNumber,
                displayName: waba.displayName,
                qualityRating: waba.qualityRating,
                messagingTier: waba.messagingTier,
              }
            : null,
      },
    };
  }

  async saveBusinessInfo(tenantId: string, dto: BusinessInfoDto) {
    if (!dto.businessName || !dto.category || !dto.description) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "businessName, category and description are required",
        },
      });
    }

    await this.userModel.findByIdAndUpdate(tenantId, {
      company: dto.businessName,
      industry: dto.category,
      description: dto.description,
      ...(dto.website && { website: dto.website }),
      ...(dto.address && { address: dto.address }),
      businessInfoSaved: true,
    });

    return {
      success: true,
      data: { message: "Business info saved", nextStep: 2 },
    };
  }

  async connectMeta(tenantId: string, dto: ConnectMetaDto) {
    // Step 1 — short-lived token
    let shortToken: string;
    try {
      const resp = await axios.get<{ access_token: string }>(
        `${BASE}/oauth/access_token`,
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            code: dto.code,
          },
        },
      );
      shortToken = resp.data.access_token;
    } catch {
      throw new BadRequestException({
        success: false,
        error: { code: "INVALID_CODE", message: "Meta code exchange failed" },
      });
    }

    // Step 2 — long-lived token (60 days)
    let longToken: string;
    try {
      const resp = await axios.get<{ access_token: string }>(
        `${BASE}/oauth/access_token`,
        {
          params: {
            grant_type: "fb_exchange_token",
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            fb_exchange_token: shortToken,
          },
        },
      );
      longToken = resp.data.access_token;
    } catch {
      throw new BadRequestException({
        success: false,
        error: {
          code: "INVALID_CODE",
          message: "Failed to exchange for long-lived token",
        },
      });
    }

    // Step 3 — discover WABA if not provided
    let wabaId = dto.wabaId;
    if (!wabaId) {
      try {
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
      } catch {
        throw new BadRequestException({
          success: false,
          error: {
            code: "NO_WABA_FOUND",
            message: "No WABA found on this Facebook account",
          },
        });
      }
    }
    if (!wabaId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "NO_WABA_FOUND",
          message: "No WABA found on this Facebook account",
        },
      });
    }

    // Step 4 — get phone numbers
    type PhoneEntry = {
      id: string;
      display_phone_number: string;
      verified_name: string;
      quality_rating: string;
      messaging_limit_tier: string;
    };
    let phone: PhoneEntry;
    try {
      const phonesResp = await axios.get(`${BASE}/${wabaId}/phone_numbers`, {
        params: {
          fields:
            "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier",
          access_token: longToken,
        },
      });
      const phones = (phonesResp.data as { data?: PhoneEntry[] }).data ?? [];
      phone = phones[0];
    } catch {
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_API_ERROR",
          message: "Failed to fetch phone numbers",
        },
      });
    }
    if (!phone!) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "NO_WABA_FOUND",
          message: "No phone numbers found in WABA",
        },
      });
    }

    // Step 5 — subscribe app to WABA
    await axios
      .post(
        `${BASE}/${wabaId}/subscribed_apps`,
        {},
        {
          params: { access_token: longToken },
        },
      )
      .catch(() => null);

    const encrypted = this.encryption.encrypt(longToken);
    const phoneNumberId = dto.phoneNumberId ?? phone.id;

    await this.wabaModel
      .findOneAndUpdate(
        { tenantId },
        {
          tenantId,
          wabaId,
          phoneNumberId,
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

    return {
      success: true,
      data: {
        wabaId,
        phoneNumberId,
        phoneNumber: phone.display_phone_number,
        displayName: phone.verified_name,
        qualityRating: phone.quality_rating ?? "GREEN",
        messagingTier: phone.messaging_limit_tier ?? "TIER_1K",
        nextStep: 3,
      },
    };
  }

  async requestVerificationCode(tenantId: string, dto: VerifyPhoneDto) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) {
      throw new BadRequestException({
        success: false,
        error: { code: "PHONE_NOT_FOUND", message: "WhatsApp not connected" },
      });
    }

    const token = this.encryption.decrypt(waba.accessToken);

    // Check if the phone is already verified on Meta's side
    try {
      const phoneResp = await axios.get<{
        code_verification_status?: string;
      }>(`${BASE}/${dto.phoneNumberId}`, {
        params: { fields: "code_verification_status", access_token: token },
      });
      if (phoneResp.data.code_verification_status === "VERIFIED") {
        await this.wabaModel.updateOne({ tenantId }, { phoneVerified: true });
        return {
          success: true,
          data: {
            message: "Phone number is already verified",
            alreadyVerified: true,
            nextStep: 4,
          },
        };
      }
    } catch {
      // ignore — proceed to request_code
    }

    try {
      await axios.post(
        `${BASE}/${dto.phoneNumberId}/request_code`,
        { code_method: dto.method, language: "en_US" },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const metaErr = (
          err.response?.data as {
            error?: { message?: string; code?: number };
          }
        )?.error;
        // "Request code error" means the number is already verified on Meta
        if (metaErr?.message?.toLowerCase().includes("request code error")) {
          await this.wabaModel.updateOne({ tenantId }, { phoneVerified: true });
          return {
            success: true,
            data: {
              message: "Phone number is already verified",
              alreadyVerified: true,
              nextStep: 4,
            },
          };
        }
        if (err.response?.status === 429) {
          throw new BadRequestException({
            success: false,
            error: {
              code: "TOO_MANY_REQUESTS",
              message: "Meta rate limited the OTP request",
            },
          });
        }
        throw new BadRequestException({
          success: false,
          error: {
            code: "META_REQUEST_FAIL",
            message: metaErr?.message ?? "Meta rejected the OTP request",
          },
        });
      }
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_REQUEST_FAIL",
          message: "Meta rejected the OTP request",
        },
      });
    }

    return {
      success: true,
      data: { message: `OTP sent via ${dto.method}`, method: dto.method },
    };
  }

  async confirmVerificationCode(tenantId: string, dto: ConfirmPhoneDto) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba) {
      throw new BadRequestException({
        success: false,
        error: { code: "PHONE_NOT_FOUND", message: "WhatsApp not connected" },
      });
    }

    const token = this.encryption.decrypt(waba.accessToken);
    try {
      await axios.post(
        `${BASE}/${dto.phoneNumberId}/verify_code`,
        { code: dto.code },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const code = (err.response?.data as { error?: { code?: number } })
          ?.error?.code;
        if (code === 100) {
          throw new BadRequestException({
            success: false,
            error: { code: "INVALID_CODE", message: "Wrong OTP entered" },
          });
        }
      }
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_VERIFY_FAIL",
          message: "Meta verification failed",
        },
      });
    }

    await this.wabaModel.updateOne({ tenantId }, { phoneVerified: true });

    return {
      success: true,
      data: { message: "Phone number verified", nextStep: 4 },
    };
  }

  async sendTestMessage(tenantId: string) {
    const [waba, user] = await Promise.all([
      this.wabaModel.findOne({ tenantId }).exec(),
      this.userModel.findById(tenantId).exec(),
    ]);

    if (!waba || !waba.metaConnected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_NOT_CONNECTED",
          message: "WhatsApp not connected",
        },
      });
    }
    if (!user?.phone) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "NO_OWNER_PHONE",
          message:
            "Owner has no phone number saved. Update your profile with a phone number first.",
        },
      });
    }

    const token = this.encryption.decrypt(waba.accessToken);
    const toNumber = user.phone.replace("+", "");

    let messageId: string | undefined;
    try {
      const resp = await axios.post(
        `${BASE}/${waba.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: toNumber,
          type: "template",
          template: { name: "hello_world", language: { code: "en_US" } },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      messageId = (resp.data as { messages?: Array<{ id: string }> })
        .messages?.[0]?.id;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const errMsg = (err.response?.data as { error?: { message?: string } })
          ?.error?.message;
        if (errMsg?.toLowerCase().includes("template")) {
          throw new BadRequestException({
            success: false,
            error: {
              code: "TEMPLATE_ERROR",
              message: "hello_world template not available on this WABA",
            },
          });
        }
      }
      throw new BadRequestException({
        success: false,
        error: { code: "META_SEND_FAIL", message: "Meta rejected the message" },
      });
    }

    await this.wabaModel.updateOne({ tenantId }, { testMessageSent: true });

    return {
      success: true,
      data: {
        message: `Test message sent to ${user.phone}`,
        messageId,
        sentTo: user.phone,
        nextStep: 5,
      },
    };
  }

  async completeSetup(tenantId: string) {
    const [user, waba] = await Promise.all([
      this.userModel.findById(tenantId).exec(),
      this.wabaModel.findOne({ tenantId }).exec(),
    ]);

    if (
      !user?.businessInfoSaved ||
      !waba?.metaConnected ||
      !waba?.phoneVerified ||
      !waba?.testMessageSent
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "SETUP_INCOMPLETE",
          message: "Not all steps completed yet",
        },
      });
    }

    await this.userModel.findByIdAndUpdate(tenantId, {
      whatsappSetupDone: true,
    });

    return {
      success: true,
      data: { message: "WhatsApp setup complete", whatsappSetupDone: true },
    };
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
