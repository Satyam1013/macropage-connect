import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import {
  Message,
  MessageDocument,
  MessageType,
} from "../schemas/message.schema";
import { MetaService } from "../meta/meta.service";
import { EventsGateway } from "../gateway/events.gateway";
import {
  SendMessageDto,
  AddNoteDto,
  UpdateConversationDto,
} from "./dto/send-message.dto";

export interface ConversationFilters {
  status?: string;
  assignedTo?: string;
  unread?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    private readonly metaService: MetaService,
    private readonly gateway: EventsGateway,
  ) {}

  async findAll(
    tenantId: string,
    userId: string,
    role: string,
    filters: ConversationFilters = {},
  ) {
    const { status, assignedTo, unread, page = 1, limit = 20 } = filters;
    const where: Record<string, unknown> = { tenantId };

    if (role === "AGENT") where.assignedTo = userId;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (unread) where.unreadCount = { $gt: 0 };

    const [data, total] = await Promise.all([
      this.convModel
        .find(where)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.convModel.countDocuments(where),
    ]);

    return { data, total, page, limit };
  }

  async findOne(
    tenantId: string,
    id: string,
    userId: string,
    role: string,
  ): Promise<ConversationDocument> {
    const conv = await this.convModel.findOne({ _id: id, tenantId }).exec();
    if (!conv) throw new NotFoundException("Conversation not found");
    if (role === "AGENT" && conv.assignedTo !== userId) {
      throw new ForbiddenException("Access denied");
    }
    await this.convModel.updateOne({ _id: id }, { unreadCount: 0 });
    return conv;
  }

  async getMessages(
    tenantId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ) {
    const [data, total] = await Promise.all([
      this.msgModel
        .find({ conversationId, tenantId })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.msgModel.countDocuments({ conversationId, tenantId }),
    ]);
    return { data, total, page, limit };
  }

  async sendMessage(
    tenantId: string,
    conversationId: string,
    dto: SendMessageDto,
    agentId: string,
  ): Promise<MessageDocument> {
    const conv = await this.convModel
      .findOne({ _id: conversationId, tenantId })
      .exec();
    if (!conv) throw new NotFoundException("Conversation not found");

    const client = await this.metaService.getClient(tenantId);

    const contactPhone = (conv as ConversationDocument & { phone?: string })
      .phone;
    let payload: Record<string, unknown>;

    if (dto.type === "TEXT") {
      payload = {
        messaging_product: "whatsapp",
        to: contactPhone,
        type: "text",
        text: { body: dto.content },
      };
    } else if (dto.type === "TEMPLATE") {
      payload = {
        messaging_product: "whatsapp",
        to: contactPhone,
        type: "template",
        template: {
          name: dto.templateName,
          language: { code: "en_US" },
        },
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to: contactPhone,
        type: dto.type.toLowerCase(),
        [dto.type.toLowerCase()]: { link: dto.mediaUrl, caption: dto.caption },
      };
    }

    const resp = await client.sendMessage(payload);
    const metaMessageId = (resp.data as { messages?: Array<{ id: string }> })
      ?.messages?.[0]?.id;

    const message = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: dto.type as MessageType,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      metaMessageId,
      status: "SENT",
      agentId,
      sentAt: new Date(),
    });

    await this.convModel.updateOne(
      { _id: conversationId },
      { lastMessageAt: new Date() },
    );

    this.gateway.emitToTenant(tenantId, "message:new", message);
    return message;
  }

  async addNote(
    tenantId: string,
    conversationId: string,
    dto: AddNoteDto,
    agentId: string,
  ): Promise<MessageDocument> {
    const note = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: "NOTE",
      content: dto.content,
      isNote: true,
      agentId,
    });
    this.gateway.emitToTenant(tenantId, "message:new", note);
    return note;
  }

  async updateConversation(
    tenantId: string,
    id: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationDocument> {
    const conv = await this.convModel
      .findOneAndUpdate({ _id: id, tenantId }, dto, { new: true })
      .exec();
    if (!conv) throw new NotFoundException("Conversation not found");
    this.gateway.emitToTenant(tenantId, "conversation:updated", conv);
    return conv;
  }

  async resolveConversation(
    tenantId: string,
    id: string,
  ): Promise<ConversationDocument> {
    return this.updateConversation(tenantId, id, { status: "RESOLVED" });
  }

  async findOrCreate(
    tenantId: string,
    contactId: string,
  ): Promise<ConversationDocument> {
    const existing = await this.convModel
      .findOne({ tenantId, contactId, status: { $ne: "RESOLVED" } })
      .exec();
    if (existing) return existing;

    const conv = await this.convModel.create({ tenantId, contactId });
    this.gateway.emitToTenant(tenantId, "conversation:new", conv);
    return conv;
  }

  async handleInboundMessage(
    tenantId: string,
    metaMsgId: string,
    contactId: string,
    conversationId: string,
    content: string,
    type: string,
    timestamp: number,
  ): Promise<MessageDocument> {
    const message = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "INBOUND",
      type: type.toUpperCase() as MessageType,
      content,
      metaMessageId: metaMsgId,
      createdAt: new Date(timestamp * 1000),
    });

    await this.convModel.updateOne(
      { _id: conversationId },
      { lastMessageAt: new Date(timestamp * 1000), $inc: { unreadCount: 1 } },
    );

    this.gateway.emitToTenant(tenantId, "message:new", message);
    return message;
  }

  async updateMessageStatus(
    tenantId: string,
    metaMessageId: string,
    status: string,
    timestamp: number,
  ): Promise<void> {
    const update: Record<string, unknown> = { status: status.toUpperCase() };
    if (status === "delivered") update.deliveredAt = new Date(timestamp * 1000);
    if (status === "read") update.readAt = new Date(timestamp * 1000);
    if (status === "failed") update.failedAt = new Date(timestamp * 1000);

    const msg = await this.msgModel
      .findOneAndUpdate({ tenantId, metaMessageId }, update, { new: true })
      .exec();

    if (msg) {
      this.gateway.emitToTenant(tenantId, "message:status", {
        messageId: msg.id,
        status: status.toUpperCase(),
      });
    }
  }
}
