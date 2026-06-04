import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { InjectQueue } from "@nestjs/bullmq";
import { Model } from "mongoose";
import { Queue } from "bullmq";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import {
  CampaignRecipient,
  CampaignRecipientDocument,
} from "../schemas/campaign-recipient.schema";
import { ContactsService } from "../contacts/contacts.service";

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
    @InjectModel(CampaignRecipient.name)
    private readonly recipientModel: Model<CampaignRecipientDocument>,
    @InjectQueue("campaigns")
    private readonly campaignQueue: Queue,
    private readonly contactsService: ContactsService,
  ) {}

  async findAll(tenantId: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;
    return this.campaignModel.find(where).sort({ createdAt: -1 }).exec();
  }

  async findOne(tenantId: string, id: string): Promise<CampaignDocument> {
    const c = await this.campaignModel.findOne({ _id: id, tenantId }).exec();
    if (!c) throw new NotFoundException("Campaign not found");
    return c;
  }

  async create(
    tenantId: string,
    userId: string,
    dto: Partial<CampaignDocument>,
  ): Promise<CampaignDocument> {
    return this.campaignModel.create({
      ...dto,
      tenantId,
      createdBy: userId,
      status: "DRAFT",
    });
  }

  async launch(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);

    if (!["DRAFT", "SCHEDULED"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be launched in current state",
      );
    }

    const { data: contacts } = await this.contactsService.findAll(tenantId, {
      tags: campaign.audienceTags.length ? campaign.audienceTags : undefined,
      isOptedOut: false,
      limit: 100000,
    });

    await this.recipientModel.insertMany(
      contacts.map((c) => ({
        campaignId: id,
        contactId: c.id,
        phone: c.phone,
        status: "pending",
      })),
      { ordered: false },
    );

    await this.campaignModel.updateOne(
      { _id: id },
      {
        status: "RUNNING",
        totalContacts: contacts.length,
        validContacts: contacts.length,
        startedAt: new Date(),
      },
    );

    await this.campaignQueue.add("send_campaign", { campaignId: id, tenantId });

    return this.findOne(tenantId, id);
  }

  async pause(tenantId: string, id: string): Promise<CampaignDocument> {
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "PAUSED", pausedAt: new Date() },
    );
    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string): Promise<CampaignDocument> {
    const campaign = await this.findOne(tenantId, id);
    if (!["SCHEDULED", "PAUSED", "DRAFT"].includes(campaign.status)) {
      throw new BadRequestException(
        "Campaign cannot be cancelled in current state",
      );
    }
    await this.campaignModel.updateOne(
      { _id: id, tenantId },
      { status: "CANCELLED" },
    );
    return this.findOne(tenantId, id);
  }

  async getRecipients(
    tenantId: string,
    campaignId: string,
    page = 1,
    limit = 50,
  ) {
    await this.findOne(tenantId, campaignId);
    const [data, total] = await Promise.all([
      this.recipientModel
        .find({ campaignId })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.recipientModel.countDocuments({ campaignId }),
    ]);
    return { data, total, page, limit };
  }
}
