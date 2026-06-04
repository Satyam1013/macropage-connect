import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { APIKey, APIKeyDocument } from "../schemas/api-key.schema";
import {
  WebhookEndpoint,
  WebhookEndpointDocument,
} from "../schemas/webhook-endpoint.schema";

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(APIKey.name)
    private readonly apiKeyModel: Model<APIKeyDocument>,
    @InjectModel(WebhookEndpoint.name)
    private readonly webhookModel: Model<WebhookEndpointDocument>,
  ) {}

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
    const keyHash = await bcrypt.hash(raw, 10);
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
      .findOneAndUpdate({ _id: id, tenantId }, dto, { new: true })
      .exec();
    if (!wh) throw new NotFoundException("Webhook not found");
    return wh;
  }

  async deleteWebhook(tenantId: string, id: string): Promise<void> {
    await this.webhookModel.deleteOne({ _id: id, tenantId });
  }
}
