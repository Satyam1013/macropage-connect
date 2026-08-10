import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as crypto from "crypto";
import axios from "axios";
import { APIKey, APIKeyDocument } from "../schemas/api-key.schema";
import {
  WebhookEndpoint,
  WebhookEndpointDocument,
} from "../schemas/webhook-endpoint.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { UploadService } from "../upload/upload.service";

interface AccountUpdateDto {
  companyName?: string;
  website?: string;
  description?: string;
  industry?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
  language?: string;
  currency?: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(APIKey.name)
    private readonly apiKeyModel: Model<APIKeyDocument>,
    @InjectModel(WebhookEndpoint.name)
    private readonly webhookModel: Model<WebhookEndpointDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly uploadService: UploadService,
  ) {}

  // ─── Account (company) settings ──────────────────────────────────────────
  // tenantId may point at a standalone Tenant doc (created via
  // POST /auth/create-account) or, for the legacy convention, an owner
  // User's own doc — every method here tries Tenant first.

  private tenantToAccount(tenant: TenantDocument) {
    return {
      _id: tenant._id,
      name: tenant.name,
      company: tenant.name,
      email: tenant.email,
      website: tenant.website,
      description: tenant.description,
      industry: tenant.industry,
      address: tenant.address,
      city: tenant.city,
      state: tenant.state,
      country: tenant.country,
      postalCode: tenant.postalCode,
      timezone: tenant.timezone,
      language: tenant.language,
      logoUrl: tenant.logoUrl,
      createdAt: tenant.createdAt,
    };
  }

  async getAccount(tenantId: string) {
    const tenant = await this.tenantModel.findById(tenantId).exec();
    if (tenant) return { success: true, data: this.tenantToAccount(tenant) };

    const user = await this.userModel
      .findById(tenantId)
      .select(
        "_id name company email website description industry address city state country postalCode timezone language logoUrl createdAt",
      )
      .lean()
      .exec();
    if (!user) throw new NotFoundException("Account not found");
    return { success: true, data: user };
  }

  async updateAccount(tenantId: string, dto: AccountUpdateDto) {
    const tenant = await this.tenantModel.findById(tenantId).exec();
    if (tenant) {
      const update: Record<string, unknown> = {};
      if (dto.companyName !== undefined) update.name = dto.companyName;
      if (dto.website !== undefined) update.website = dto.website;
      if (dto.description !== undefined) update.description = dto.description;
      if (dto.industry !== undefined) update.industry = dto.industry;
      if (dto.address !== undefined) update.address = dto.address;
      if (dto.city !== undefined) update.city = dto.city;
      if (dto.state !== undefined) update.state = dto.state;
      if (dto.country !== undefined) update.country = dto.country;
      if (dto.postalCode !== undefined) update.postalCode = dto.postalCode;
      if (dto.timezone !== undefined) update.timezone = dto.timezone;
      if (dto.language !== undefined) update.language = dto.language;
      if (dto.currency !== undefined) update.currency = dto.currency;

      const updated = await this.tenantModel
        .findByIdAndUpdate(tenantId, update, { returnDocument: "after" })
        .exec();
      if (!updated) throw new NotFoundException("Account not found");
      return { success: true, data: this.tenantToAccount(updated) };
    }

    const update: Record<string, unknown> = {};
    if (dto.companyName !== undefined) update.company = dto.companyName;
    if (dto.website !== undefined) update.website = dto.website;
    if (dto.description !== undefined) update.description = dto.description;
    if (dto.industry !== undefined) update.industry = dto.industry;
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.city !== undefined) update.city = dto.city;
    if (dto.state !== undefined) update.state = dto.state;
    if (dto.country !== undefined) update.country = dto.country;
    if (dto.postalCode !== undefined) update.postalCode = dto.postalCode;
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    if (dto.language !== undefined) update.language = dto.language;

    const updated = await this.userModel
      .findByIdAndUpdate(tenantId, update, { returnDocument: "after" })
      .select(
        "_id name company email website description industry address city state country postalCode timezone language logoUrl",
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException("Account not found");
    return { success: true, data: updated };
  }

  async uploadLogo(tenantId: string, file: Express.Multer.File) {
    if (!file.mimetype.startsWith("image/")) {
      throw new BadRequestException("File must be an image");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException("Logo must be under 2 MB");
    }

    const result = await this.uploadService.uploadImage(tenantId, file);
    const isTenant = await this.tenantModel.exists({ _id: tenantId });
    if (isTenant) {
      await this.tenantModel.updateOne(
        { _id: tenantId },
        { logoUrl: result.url },
      );
    } else {
      await this.userModel.findByIdAndUpdate(tenantId, {
        logoUrl: result.url,
      });
    }
    return { success: true, data: { logoUrl: result.url } };
  }

  // ─── User profile ─────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select(
        "_id name email phone avatarUrl role department jobTitle timezone language twoFactorEnabled emailVerified createdAt lastLoginAt",
      )
      .lean()
      .exec();
    if (!user) throw new NotFoundException("User not found");
    return { success: true, data: user };
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      phone?: string;
      department?: string;
      jobTitle?: string;
      timezone?: string;
      language?: string;
    },
  ) {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.department !== undefined) update.department = dto.department;
    if (dto.jobTitle !== undefined) update.jobTitle = dto.jobTitle;
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    if (dto.language !== undefined) update.language = dto.language;

    const updated = await this.userModel
      .findByIdAndUpdate(userId, update, { returnDocument: "after" })
      .select(
        "_id name email phone avatarUrl role department jobTitle timezone language",
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException("User not found");
    return { success: true, data: updated };
  }

  // ─── Notification preferences ─────────────────────────────────────────────

  private defaultNotificationPrefs() {
    return {
      channels: { email: true, inApp: true, whatsapp: false },
      events: {
        new_conversation: { email: false, inApp: true },
        message_received: { email: false, inApp: true },
        conversation_assigned: { email: true, inApp: true },
        conversation_resolved: { email: false, inApp: true },
        campaign_completed: { email: true, inApp: true },
        campaign_failed: { email: true, inApp: true },
        member_joined: { email: true, inApp: true },
        payment_failed: { email: true, inApp: true },
        template_approved: { email: true, inApp: true },
        template_rejected: { email: true, inApp: true },
        trial_ending: { email: true, inApp: true },
      },
      quietHours: { enabled: false, from: "22:00", to: "08:00", days: [0, 6] },
    };
  }

  async getNotificationPrefs(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select("notificationPrefs")
      .lean()
      .exec();
    const prefs =
      user?.notificationPrefs && Object.keys(user.notificationPrefs).length > 0
        ? user.notificationPrefs
        : this.defaultNotificationPrefs();
    return { success: true, data: prefs };
  }

  async updateNotificationPrefs(userId: string, dto: Record<string, unknown>) {
    await this.userModel.findByIdAndUpdate(userId, {
      notificationPrefs: dto,
    });
    return { success: true, data: dto };
  }

  // ─── API Keys ─────────────────────────────────────────────────────────────

  async listApiKeys(tenantId: string) {
    return this.apiKeyModel
      .find({ tenantId, isActive: true })
      .select("-keyHash")
      .sort({ createdAt: -1 })
      .exec();
  }

  async createApiKey(
    tenantId: string,
    name: string,
    permissions: string[],
  ): Promise<{ key: string; record: APIKeyDocument }> {
    const raw = "mk_live_" + crypto.randomBytes(24).toString("hex");
    // The raw key already carries 192 bits of random entropy, so a plain
    // digest (unlike bcrypt's per-hash salt) still resists brute force
    // while staying directly indexable for the O(1) lookup ApiKeyGuard needs.
    const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
    const keyPreview = raw.slice(-8);

    const record = await this.apiKeyModel.create({
      tenantId,
      name,
      keyHash,
      keyPreview,
      permissions,
    });

    return { key: raw, record };
  }

  async revokeApiKey(tenantId: string, keyId: string): Promise<void> {
    const result = await this.apiKeyModel.updateOne(
      { _id: keyId, tenantId },
      { isActive: false },
    );
    if (!result.matchedCount) throw new NotFoundException("API key not found");
  }

  // Used by ApiKeyGuard to authenticate requests to the public API.
  async validateApiKey(
    rawKey: string,
    ip?: string,
  ): Promise<APIKeyDocument | null> {
    if (!rawKey.startsWith("mk_live_")) return null;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const record = await this.apiKeyModel
      .findOne({ keyHash, isActive: true })
      .exec();
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;
    if (
      record.ipRestrictions.length > 0 &&
      (!ip || !record.ipRestrictions.includes(ip))
    ) {
      return null;
    }

    await this.apiKeyModel
      .updateOne(
        { _id: record._id },
        { $set: { lastUsedAt: new Date() }, $inc: { requestsToday: 1 } },
      )
      .exec();

    return record;
  }

  // ─── Webhooks ─────────────────────────────────────────────────────────────

  async listWebhooks(tenantId: string) {
    return this.webhookModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
  }

  async createWebhook(
    tenantId: string,
    url: string,
    events: string[],
    description?: string,
  ): Promise<WebhookEndpointDocument> {
    if (!url.startsWith("https://")) {
      throw new BadRequestException("Webhook URL must use HTTPS");
    }
    const secret = crypto.randomBytes(32).toString("hex");
    return this.webhookModel.create({
      tenantId,
      url,
      events,
      description,
      secretHash: secret,
    });
  }

  async updateWebhook(
    tenantId: string,
    id: string,
    dto: Partial<{ url: string; events: string[]; isEnabled: boolean }>,
  ): Promise<WebhookEndpointDocument> {
    const wh = await this.webhookModel
      .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
      .exec();
    if (!wh) throw new NotFoundException("Webhook not found");
    return wh;
  }

  async deleteWebhook(tenantId: string, id: string): Promise<void> {
    await this.webhookModel.deleteOne({ _id: id, tenantId });
  }

  async testWebhook(tenantId: string, id: string) {
    const webhook = await this.webhookModel
      .findOne({ _id: id, tenantId })
      .lean()
      .exec();
    if (!webhook) throw new NotFoundException("Webhook not found");

    const payload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      data: { message: "This is a test webhook from Macropage Connect" },
    };

    const signature = crypto
      .createHmac("sha256", webhook.secretHash ?? "no-secret")
      .update(JSON.stringify(payload))
      .digest("hex");

    const start = Date.now();
    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Macropage-Signature": signature,
          "X-Macropage-Event": "webhook.test",
          "X-Macropage-Delivery": crypto.randomUUID(),
        },
        timeout: 10000,
      });
      return {
        success: true,
        data: {
          statusCode: response.status,
          responseTime: Date.now() - start,
          ok: response.status >= 200 && response.status < 300,
        },
      };
    } catch (err) {
      return {
        success: false,
        data: {
          statusCode: axios.isAxiosError(err) ? (err.response?.status ?? 0) : 0,
          responseTime: Date.now() - start,
          error: err instanceof Error ? err.message : "Unknown error",
          ok: false,
        },
      };
    }
  }
}
