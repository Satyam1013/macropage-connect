import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import { META_GRAPH_BASE as BASE } from "../meta/meta.constants";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { EncryptionService } from "../meta/encryption.service";
import {
  BusinessInfoDto,
  ConnectMetaDto,
  VerifyPhoneDto,
  ConfirmPhoneDto,
} from "./dto/whatsapp.dto";
import { RegisterPhoneDto } from "./dto/register-phone.dto";
import { EmailService } from "../queue/email.service";
import { WABADetailsData } from "./whatsapp.types";

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    private readonly emailService: EmailService,
    private readonly encryption: EncryptionService,
  ) {}

  async getStatus(tenantId: string) {
    const [tenant, user, waba, approvedTemplates, totalTemplates] =
      await Promise.all([
        this.tenantModel.findById(tenantId).exec(),
        this.userModel.findById(tenantId).exec(),
        this.wabaModel.findOne({ tenantId }).exec(),
        this.templateModel.countDocuments({ tenantId, status: "APPROVED" }),
        this.templateModel.countDocuments({ tenantId }),
      ]);

    const businessInfoSaved =
      tenant?.businessInfoSaved ?? user?.businessInfoSaved ?? false;
    const metaConnected = waba?.metaConnected ?? false;
    const phoneVerified = waba?.phoneVerified ?? false;
    const testMessageSent = waba?.testMessageSent ?? false;
    const phoneRegistered: boolean = Boolean(waba?.phoneRegistered);

    let currentStep: number;
    if (!businessInfoSaved) currentStep = 1;
    else if (!metaConnected) currentStep = 2;
    else if (!phoneVerified) currentStep = 3;
    else if (!testMessageSent) currentStep = 4;
    else currentStep = 5;

    // waba.setupComplete only tracks the Meta phone-registration API call
    // (see registerPhoneNumber) — it's unrelated to the onboarding wizard
    // steps above. The wizard is only actually complete once every step,
    // including the test message, has run.
    const setupComplete = currentStep === 5;

    return {
      success: true,
      data: {
        currentStep,
        businessInfoSaved,
        metaConnected,
        phoneVerified,
        testMessageSent,
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
        approvedTemplates,
        totalTemplates,
        readyToSend: approvedTemplates > 0,
        phoneRegistered,
        setupComplete,
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

    const isTenant = await this.tenantModel.exists({ _id: tenantId });
    const update = {
      industry: dto.category,
      description: dto.description,
      ...(dto.website && { website: dto.website }),
      ...(dto.address && { address: dto.address }),
      businessInfoSaved: true,
    };
    if (isTenant) {
      await this.tenantModel.findByIdAndUpdate(tenantId, {
        name: dto.businessName,
        ...update,
      });
    } else {
      await this.userModel.findByIdAndUpdate(tenantId, {
        company: dto.businessName,
        ...update,
      });
    }

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
    const phoneNumberId = (dto.phoneNumberId ?? phone.id)?.trim();

    if (!phoneNumberId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "NO_PHONE_NUMBER_ID",
          message:
            "Could not determine Phone Number ID from Meta. Please provide it manually.",
        },
      });
    }

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
        { returnDocument: "after", upsert: true },
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

  async sendTestMessage(tenantId: string, toPhone?: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();

    if (!waba || !waba.metaConnected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_NOT_CONNECTED",
          message: "WhatsApp not connected",
        },
      });
    }

    if (!waba.phoneNumberId) {
      this.logger.error(
        `[sendTest] phoneNumberId missing for tenant ${tenantId} — reconnect WhatsApp`,
      );
      throw new BadRequestException({
        success: false,
        error: {
          code: "MISSING_PHONE_NUMBER_ID",
          message:
            "WhatsApp phone number ID not configured. Please disconnect and reconnect your WhatsApp account.",
        },
      });
    }

    if (!toPhone) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "NO_PHONE",
          message: "toPhone is required in the request body.",
        },
      });
    }
    const rawPhone = toPhone;

    const token = this.encryption.decrypt(waba.accessToken);
    // Normalise to E.164 without '+': ensure country code is present
    const digits = rawPhone.replace(/\D/g, "");
    const toNumber = digits.startsWith("91") ? digits : `91${digits}`;

    let messageId: string | undefined;
    try {
      const resp = await axios.post(
        `${BASE}/${waba.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: {
            body: "✅ Your Macropage Connect WhatsApp integration is working! This is a test message.",
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      messageId = (resp.data as { messages?: Array<{ id: string }> })
        .messages?.[0]?.id;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const metaError = (
          err.response?.data as { error?: { message?: string; code?: number } }
        )?.error;
        this.logger.error(
          `[sendTest] Meta error: ${JSON.stringify(metaError ?? err.message)}`,
        );

        // 131026 = outside 24h window — user needs to message WABA first
        if (metaError?.code === 131026) {
          throw new BadRequestException({
            success: false,
            error: {
              code: "OUTSIDE_WINDOW",
              message:
                "To receive a test message, first send a WhatsApp message to your business number from your personal WhatsApp. Then try again.",
            },
          });
        }

        // 133010 = recipient not on WhatsApp
        if (metaError?.code === 133010) {
          throw new BadRequestException({
            success: false,
            error: {
              code: "NOT_ON_WHATSAPP",
              message: `The phone number +${toNumber} is not registered on WhatsApp. Update your profile with the correct WhatsApp number.`,
            },
          });
        }

        throw new BadRequestException({
          success: false,
          error: {
            code: "META_SEND_FAIL",
            message:
              metaError?.message ?? "Meta rejected the message — check token",
          },
        });
      }
      this.logger.error("[sendTest] Unexpected error", err);
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_SEND_FAIL",
          message: "Unexpected error sending test message",
        },
      });
    }

    await this.wabaModel.updateOne({ tenantId }, { testMessageSent: true });

    return {
      success: true,
      data: {
        message: `Test message sent to +${toNumber}`,
        messageId,
        sentTo: `+${toNumber}`,
        nextStep: 5,
      },
    };
  }

  async completeSetup(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();

    if (!waba?.metaConnected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "SETUP_INCOMPLETE",
          message: "WhatsApp account not connected yet",
        },
      });
    }

    const isTenant = await this.tenantModel.exists({ _id: tenantId });
    await Promise.all([
      isTenant
        ? this.tenantModel.findByIdAndUpdate(tenantId, {
            whatsappSetupDone: true,
          })
        : this.userModel.findByIdAndUpdate(tenantId, {
            whatsappSetupDone: true,
          }),
      this.wabaModel.updateOne(
        { tenantId },
        { phoneVerified: true, testMessageSent: true },
      ),
    ]);

    return {
      success: true,
      data: { message: "WhatsApp setup complete", whatsappSetupDone: true },
    };
  }

  async updateProfile(
    tenantId: string,
    dto: {
      about?: string;
      address?: string;
      description?: string;
      email?: string;
      websites?: string[];
      vertical?: string;
    },
  ) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba?.metaConnected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_NOT_CONNECTED",
          message: "WhatsApp not connected",
        },
      });
    }

    const token = this.encryption.decrypt(waba.accessToken);
    try {
      await axios.post(
        `${BASE}/${waba.phoneNumberId}/whatsapp_business_profile`,
        { messaging_product: "whatsapp", ...dto },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { error?: { message?: string } })
          ?.error?.message;
        throw new BadRequestException({
          success: false,
          error: {
            code: "META_PROFILE_UPDATE_FAIL",
            message: msg ?? "Failed to update WhatsApp profile",
          },
        });
      }
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_PROFILE_UPDATE_FAIL",
          message: "Failed to update WhatsApp profile",
        },
      });
    }

    return { success: true, data: { message: "WhatsApp profile updated" } };
  }

  async refreshToken(tenantId: string, accessToken: string): Promise<object> {
    const encrypted = this.encryption.encrypt(accessToken);
    const waba = await this.wabaModel
      .findOneAndUpdate(
        { tenantId },
        {
          accessToken: encrypted,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          tokenExpired: false,
        },
        { returnDocument: "after" },
      )
      .exec();

    if (!waba) {
      throw new BadRequestException({
        success: false,
        error: { code: "WABA_NOT_FOUND", message: "No WhatsApp account found" },
      });
    }

    return { success: true, data: { message: "Access token updated" } };
  }

  async getWABADetails(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).lean().exec();

    if (!waba) {
      return { success: true, data: { connected: false } };
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [messagesToday, messagesThisMonth] = await Promise.all([
      this.messageModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        createdAt: { $gte: todayStart },
      }),
      this.messageModel.countDocuments({
        tenantId,
        direction: "OUTBOUND",
        isNote: { $ne: true },
        createdAt: { $gte: monthStart },
      }),
    ]);

    const tierLimits: Record<string, number> = {
      TIER_1K: 1000,
      TIER_10K: 10000,
      TIER_100K: 100000,
      TIER_UNLIMITED: -1,
    };

    const tier = waba.messagingTier ?? "TIER_1K";
    const tierLimit = tierLimits[tier] ?? 1000;
    const usagePercent =
      tierLimit === -1
        ? 0
        : Math.min(Math.round((messagesToday / tierLimit) * 100), 100);

    return {
      success: true,
      data: {
        connected: true,
        businessName: waba.displayName ?? null,
        wabaId: waba.wabaId ?? null,
        phoneNumber: waba.phoneNumber ?? null,
        phoneNumberId: waba.phoneNumberId ?? null,
        qualityRating: waba.qualityRating ?? "GREEN",
        messagingTier: tier,
        tierLimit,
        messagesToday,
        messagesThisMonth,
        usagePercent,
        tokenExpired: waba.tokenExpired ?? false,
        tokenExpiresAt: waba.tokenExpiresAt ?? null,
        webhookUrl: `${process.env.APP_URL}/api/v1/webhook/meta`,
        webhookVerified: waba.webhookVerified ?? false,
        connectedAt: (waba as { createdAt?: Date }).createdAt,
        updatedAt: (waba as { updatedAt?: Date }).updatedAt,
      },
    };
  }

  async shareWABADetails(
    tenantId: string,
    user: { name: string; email: string },
    toEmail?: string,
  ) {
    const result = await this.getWABADetails(tenantId);
    if (!result.data.connected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "WABA_NOT_CONNECTED",
          message: "WhatsApp not connected yet",
        },
      });
    }

    const recipient = toEmail ?? user.email;

    await this.emailService.sendRaw(
      recipient,
      `WhatsApp Business Details — ${result.data.businessName ?? "Your Account"}`,
      this.buildWABADetailsEmail(result.data as WABADetailsData, user),
    );

    return {
      success: true,
      data: { message: `Details sent to ${recipient}`, sentTo: recipient },
    };
  }

  private buildWABADetailsEmail(
    data: WABADetailsData,
    user: { name: string },
  ): string {
    const { tierLimit, qualityRating, webhookVerified } = data;
    const tierLimitStr =
      tierLimit === -1 ? "Unlimited" : tierLimit.toLocaleString("en-IN");
    const badge = (rating: string) =>
      rating === "GREEN" ? "green" : rating === "YELLOW" ? "amber" : "red";

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px}
    .header{background:#1a3d2b;color:white;padding:24px;border-radius:12px;margin-bottom:24px}
    .header h1{margin:0;font-size:20px}
    .header p{margin:4px 0 0;opacity:.7;font-size:14px}
    .card{background:#f7f8f6;border:1px solid #e8ebe8;border-radius:12px;padding:20px;margin-bottom:16px}
    .card h3{margin:0 0 12px;font-size:15px}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8ebe8}
    .row:last-child{border-bottom:none}
    .label{color:#666;font-size:13px}
    .value{font-weight:bold;font-size:13px;color:#1a3d2b;font-family:monospace}
    .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:bold}
    .green{background:#e8f5ee;color:#1a5c3a}
    .amber{background:#fff8e1;color:#f59e0b}
    .red{background:#fee2e2;color:#dc2626}
    .footer{color:#999;font-size:12px;text-align:center;margin-top:24px}
  </style>
</head>
<body>
  <div class="header">
    <h1>WhatsApp Business Details</h1>
    <p>Shared by ${user.name} from Macropage Connect</p>
  </div>
  <div class="card">
    <h3>Business Information</h3>
    <div class="row"><span class="label">Business Name</span><span class="value">${data.businessName ?? "N/A"}</span></div>
    <div class="row"><span class="label">Phone Number</span><span class="value">${data.phoneNumber ?? "N/A"}</span></div>
    <div class="row"><span class="label">WABA ID</span><span class="value">${data.wabaId ?? "N/A"}</span></div>
    <div class="row"><span class="label">Phone Number ID</span><span class="value">${data.phoneNumberId ?? "N/A"}</span></div>
  </div>
  <div class="card">
    <h3>Quality &amp; Limits</h3>
    <div class="row"><span class="label">Quality Rating</span><span class="badge ${badge(qualityRating)}">${qualityRating}</span></div>
    <div class="row"><span class="label">Messaging Tier</span><span class="value">${data.messagingTier}</span></div>
    <div class="row"><span class="label">Daily Limit</span><span class="value">${tierLimitStr} messages/day</span></div>
  </div>
  <div class="card">
    <h3>Usage</h3>
    <div class="row"><span class="label">Messages Today</span><span class="value">${data.messagesToday.toLocaleString("en-IN")}</span></div>
    <div class="row"><span class="label">Messages This Month</span><span class="value">${data.messagesThisMonth.toLocaleString("en-IN")}</span></div>
  </div>
  <div class="card">
    <h3>Webhook Configuration</h3>
    <div class="row"><span class="label">Callback URL</span><span class="value" style="font-size:11px">${data.webhookUrl}</span></div>
    <div class="row"><span class="label">Verify Token</span><span class="value">macropage_webhook_verify_2024</span></div>
    <div class="row"><span class="label">Status</span><span class="badge ${webhookVerified ? "green" : "amber"}">${webhookVerified ? "Verified" : "Not verified"}</span></div>
  </div>
  <div class="footer"><p>Sent from Macropage Connect · ${new Date().toLocaleDateString("en-IN")}</p></div>
</body>
</html>`;
  }

  async registerPhoneNumber(tenantId: string, dto: RegisterPhoneDto) {
    const waba = await this.wabaModel.findOne({ tenantId }).exec();
    if (!waba?.metaConnected) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_NOT_CONNECTED",
          message: "WhatsApp not connected",
        },
      });
    }

    if (!waba.phoneNumberId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: "MISSING_PHONE_NUMBER_ID",
          message:
            "Phone Number ID not configured — disconnect and reconnect your WhatsApp account",
        },
      });
    }

    const systemToken = process.env.META_SYSTEM_USER_TOKEN;
    if (!systemToken) {
      this.logger.error("[registerPhone] META_SYSTEM_USER_TOKEN is not set");
      throw new InternalServerErrorException({
        success: false,
        error: {
          code: "SERVER_CONFIG_ERROR",
          message: "System token not configured — contact support",
        },
      });
    }

    try {
      await axios.post(
        `https://graph.facebook.com/v25.0/${waba.phoneNumberId}/register`,
        { messaging_product: "whatsapp", pin: dto.pin },
        { headers: { Authorization: `Bearer ${systemToken}` } },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const metaErr = (
          err.response?.data as {
            error?: { message?: string; code?: number; error_subcode?: number };
          }
        )?.error;

        // 2388056 = phone already registered — treat as success
        if (metaErr?.error_subcode === 2388056) {
          await this.wabaModel.updateOne(
            { tenantId },
            {
              phoneRegistered: true,
              phoneRegisteredAt: new Date(),
              setupComplete: true,
            },
          );
          return {
            success: true,
            data: {
              message: "Phone number was already registered",
              alreadyRegistered: true,
            },
          };
        }

        throw new BadRequestException({
          success: false,
          error: {
            code: "META_REGISTER_FAIL",
            message:
              metaErr?.message ?? "Meta rejected the registration request",
          },
        });
      }
      throw new InternalServerErrorException({
        success: false,
        error: {
          code: "META_REGISTER_FAIL",
          message: "Unexpected error during phone registration",
        },
      });
    }

    await this.wabaModel.updateOne(
      { tenantId },
      {
        phoneRegistered: true,
        phoneRegisteredAt: new Date(),
        setupComplete: true,
      },
    );

    return {
      success: true,
      data: {
        message: "Phone number registered successfully",
        phoneRegistered: true,
      },
    };
  }

  async getRegistrationStatus(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).lean().exec();
    if (!waba) {
      throw new NotFoundException({
        success: false,
        error: {
          code: "WABA_NOT_FOUND",
          message: "WhatsApp account not found",
        },
      });
    }
    return {
      success: true,
      data: {
        phoneRegistered: Boolean(waba.phoneRegistered),
        phoneRegisteredAt: waba.phoneRegisteredAt ?? null,
        setupComplete: Boolean(waba.setupComplete),
      },
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
