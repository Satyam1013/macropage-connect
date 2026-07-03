import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import axios from "axios";
import { InjectModel } from "@nestjs/mongoose";
import { NotificationsService } from "../notifications/notifications.service";
import { Model } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import type { MessageType } from "../messages/messages.types";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { MetaService } from "../meta/meta.service";
import { SocketService } from "../gateway/socket.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import {
  SendMessageDto,
  AddNoteDto,
  UpdateConversationDto,
} from "./dto/send-message.dto";
import type { ConversationFilters } from "./conversations.types";

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly metaService: MetaService,
    private readonly socketService: SocketService,
    private readonly notificationsService: NotificationsService,
    private readonly campaignsService: CampaignsService,
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

    const [conversations, total] = await Promise.all([
      this.convModel
        .find(where)
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.convModel.countDocuments(where),
    ]);

    // Batch-fetch contacts and agents
    const contactIds = [
      ...new Set(conversations.map((c) => c.contactId).filter(Boolean)),
    ];
    const agentIds = [
      ...new Set(conversations.map((c) => c.assignedTo).filter(Boolean)),
    ] as string[];

    const [contacts, agents] = await Promise.all([
      this.contactModel
        .find({ _id: { $in: contactIds } })
        .select("_id name phone email avatarUrl tags")
        .lean()
        .exec(),
      agentIds.length
        ? this.userModel
            .find({ _id: { $in: agentIds } })
            .select("_id name avatarUrl")
            .lean()
            .exec()
        : Promise.resolve([]),
    ]);

    const contactMap = Object.fromEntries(
      contacts.map((c) => [String(c._id), c]),
    );
    const agentMap = Object.fromEntries(agents.map((a) => [String(a._id), a]));

    // Fetch last message per conversation
    const data = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await this.msgModel
          .findOne({ conversationId: String(conv._id), isNote: { $ne: true } })
          .sort({ createdAt: -1 })
          .select("_id content direction type status createdAt")
          .lean()
          .exec();

        return {
          ...conv,
          contact: contactMap[String(conv.contactId)] ?? null,
          assignedAgent: conv.assignedTo
            ? (agentMap[String(conv.assignedTo)] ?? null)
            : null,
          lastMessage: lastMessage ?? null,
        };
      }),
    );

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string, userId: string, role: string) {
    const conv = await this.convModel
      .findOne({ _id: id, tenantId })
      .lean()
      .exec();
    if (!conv) throw new NotFoundException("Conversation not found");
    if (role === "AGENT" && conv.assignedTo !== userId) {
      throw new ForbiddenException("Access denied");
    }

    const [contact, assignedAgent, messages] = await Promise.all([
      this.contactModel
        .findOne({ _id: conv.contactId })
        .select(
          "_id name phone email avatarUrl tags company city isOptedOut lastMessageAt",
        )
        .lean()
        .exec(),
      conv.assignedTo
        ? this.userModel
            .findOne({ _id: conv.assignedTo })
            .select("_id name avatarUrl role")
            .lean()
            .exec()
        : Promise.resolve(null),
      this.msgModel
        .find({ conversationId: id, tenantId })
        .sort({ createdAt: 1 })
        .limit(50)
        .lean()
        .exec(),
    ]);

    // Enrich messages with agent details
    const agentIds = [
      ...new Set(messages.map((m) => m.agentId).filter(Boolean)),
    ] as string[];
    const agents = agentIds.length
      ? await this.userModel
          .find({ _id: { $in: agentIds } })
          .select("_id name avatarUrl")
          .lean()
          .exec()
      : [];
    const agentMap = Object.fromEntries(agents.map((a) => [String(a._id), a]));

    await this.convModel.updateOne({ _id: id }, { unreadCount: 0 });

    return {
      success: true,
      data: {
        ...conv,
        contact: contact ?? null,
        assignedAgent: assignedAgent ?? null,
        messages: messages.map((m) => ({
          ...m,
          agent: m.agentId ? (agentMap[String(m.agentId)] ?? null) : null,
        })),
      },
    };
  }

  async getMessages(
    tenantId: string,
    conversationId: string,
    page = 1,
    limit = 50,
  ) {
    const conv = await this.convModel
      .findOne({ _id: conversationId, tenantId })
      .lean()
      .exec();
    if (!conv) throw new NotFoundException("Conversation not found");

    const [messages, total] = await Promise.all([
      this.msgModel
        .find({ conversationId, tenantId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.msgModel.countDocuments({ conversationId, tenantId }),
    ]);

    const agentIds = [
      ...new Set(messages.map((m) => m.agentId).filter(Boolean)),
    ] as string[];
    const agents = agentIds.length
      ? await this.userModel
          .find({ _id: { $in: agentIds } })
          .select("_id name avatarUrl")
          .lean()
          .exec()
      : [];
    const agentMap = Object.fromEntries(agents.map((a) => [String(a._id), a]));

    // Return in ascending order (oldest→newest) so frontend renders correctly
    const data = messages
      .map((m) => ({
        ...m,
        agent: m.agentId ? (agentMap[String(m.agentId)] ?? null) : null,
      }))
      .reverse();

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

    const contact = await this.contactModel
      .findOne({ _id: conv.contactId, tenantId })
      .exec();
    if (!contact) throw new NotFoundException("Contact not found");

    const client = await this.metaService.getClient(tenantId);

    const contactPhone = contact.phone.replace("+", "");
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

    // Save first so message always appears in portal regardless of Meta outcome
    const message = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: dto.type as MessageType,
      content: dto.content,
      mediaUrl: dto.mediaUrl,
      status: "PENDING",
      agentId,
      sentAt: new Date(),
    });

    const updatedConv = await this.convModel
      .findOneAndUpdate(
        { _id: conversationId },
        { lastMessageAt: new Date() },
        { returnDocument: "after" },
      )
      .lean()
      .exec();

    const agent = await this.userModel
      .findById(agentId)
      .select("_id name avatarUrl")
      .lean()
      .exec();

    const agentObj = agent
      ? {
          _id: String(agent._id),
          name: agent.name,
          avatarUrl: agent.avatarUrl ?? null,
        }
      : null;

    const buildEnriched = (status: string, metaMessageId?: string | null) => ({
      _id: String(message._id),
      conversationId: String(message.conversationId),
      tenantId,
      direction: message.direction,
      type: message.type,
      content: message.content,
      mediaUrl: message.mediaUrl ?? null,
      metaMessageId: metaMessageId ?? null,
      status,
      isNote: false,
      agentId,
      agent: agentObj,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
    });

    // Show message in portal immediately with PENDING status
    this.socketService.newMessage(tenantId, buildEnriched("PENDING"));

    // Update sidebar immediately
    if (updatedConv) {
      this.socketService.conversationUpdated(tenantId, {
        ...updatedConv,
        lastMessage: {
          content: dto.content ?? dto.templateName ?? "",
          direction: "OUTBOUND",
          type: dto.type,
        },
      });
    }

    try {
      const resp = await client.sendMessage(payload);
      const metaMessageId =
        (resp.data as { messages?: Array<{ id: string }> })?.messages?.[0]
          ?.id ?? null;

      await this.msgModel.updateOne(
        { _id: message._id },
        { status: "SENT", metaMessageId },
      );

      const enriched = buildEnriched("SENT", metaMessageId);
      this.socketService.newMessage(tenantId, { ...enriched, _update: true });
      return enriched as unknown as MessageDocument;
    } catch (err: unknown) {
      await this.msgModel.updateOne({ _id: message._id }, { status: "FAILED" });
      const enriched = buildEnriched("FAILED");
      this.socketService.newMessage(tenantId, { ...enriched, _update: true });
      throw err;
    }
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

    const agent = await this.userModel
      .findById(agentId)
      .select("_id name avatarUrl")
      .lean()
      .exec();

    const enrichedNote = {
      _id: String(note._id),
      conversationId: String(note.conversationId),
      tenantId,
      direction: note.direction,
      type: note.type,
      content: note.content,
      isNote: true,
      agentId,
      agent: agent
        ? {
            _id: String(agent._id),
            name: agent.name,
            avatarUrl: agent.avatarUrl ?? null,
          }
        : null,
      createdAt: note.createdAt,
    };

    this.socketService.newMessage(tenantId, enrichedNote);
    return enrichedNote as unknown as MessageDocument;
  }

  async updateConversation(
    tenantId: string,
    id: string,
    dto: UpdateConversationDto,
  ): Promise<ConversationDocument> {
    const conv = await this.convModel
      .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
      .exec();
    if (!conv) throw new NotFoundException("Conversation not found");
    this.socketService.conversationUpdated(tenantId, conv);
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
    this.socketService.conversationCreated(tenantId, conv);
    return conv;
  }

  async initiateConversation(
    tenantId: string,
    contactId: string,
    templateName: string,
    agentId: string,
  ) {
    const contact = await this.contactModel
      .findOne({ _id: contactId, tenantId })
      .exec();
    if (!contact) throw new NotFoundException("Contact not found");

    const conv = await this.findOrCreate(tenantId, contactId);
    const client = await this.metaService.getClient(tenantId);

    const toNumber = contact.phone.replace("+", "");
    let metaMessageId: string | undefined;
    try {
      const resp = await client.sendMessage({
        messaging_product: "whatsapp",
        to: toNumber,
        type: "template",
        template: { name: templateName, language: { code: "en_US" } },
      });
      metaMessageId = (resp.data as { messages?: Array<{ id: string }> })
        ?.messages?.[0]?.id;
    } catch (err) {
      const metaError = axios.isAxiosError(err)
        ? (
            err.response?.data as {
              error?: { message?: string; code?: number };
            }
          )?.error
        : null;
      throw new BadRequestException({
        success: false,
        error: {
          code: "META_SEND_FAIL",
          message:
            metaError?.message ??
            "Meta rejected the message. Check phone number format or template name.",
        },
      });
    }

    const message = await this.msgModel.create({
      tenantId,
      conversationId: conv.id,
      direction: "OUTBOUND",
      type: "TEMPLATE",
      content: templateName,
      metaMessageId,
      status: "SENT",
      agentId,
      sentAt: new Date(),
    });

    await this.convModel.updateOne(
      { _id: conv.id },
      { lastMessageAt: new Date() },
    );

    this.socketService.newMessage(tenantId, {
      _id: String(message._id),
      conversationId: String(message.conversationId),
      direction: "OUTBOUND",
      type: "TEMPLATE",
      content: templateName,
      metaMessageId,
      status: "SENT",
      agentId,
    });

    return {
      success: true,
      data: {
        conversationId: conv.id,
        contactPhone: contact.phone,
        messageId: metaMessageId,
        templateName,
      },
    };
  }

  async handleInboundMessage(
    tenantId: string,
    metaMsgId: string,
    _contactId: string,
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

    const updatedConv = await this.convModel
      .findOneAndUpdate(
        { _id: conversationId },
        { lastMessageAt: new Date(timestamp * 1000), $inc: { unreadCount: 1 } },
        { returnDocument: "after" },
      )
      .lean()
      .exec();

    this.socketService.newMessage(tenantId, {
      _id: String(message._id),
      conversationId: String(message.conversationId),
      direction: "INBOUND",
      type: message.type,
      content: message.content,
      metaMessageId: message.metaMessageId,
      isNote: false,
    });

    // Update sidebar in real-time
    if (updatedConv) {
      this.socketService.conversationUpdated(tenantId, {
        ...updatedConv,
        lastMessage: {
          content,
          direction: "INBOUND",
          type: type.toUpperCase(),
        },
      });
    }

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
      .findOneAndUpdate({ tenantId, metaMessageId }, update, {
        returnDocument: "after",
      })
      .exec();

    if (msg) {
      this.socketService.messageStatus(tenantId, {
        messageId: String(msg._id),
        conversationId: String(msg.conversationId),
        status: status.toUpperCase(),
        timestamp: new Date().toISOString(),
      });
    }

    if (status === "delivered" || status === "read") {
      void this.campaignsService
        .handleDeliveryUpdate(metaMessageId, status, timestamp)
        .catch(() => undefined);
    }
  }

  async assignConversation(
    tenantId: string,
    conversationId: string,
    assignedByUserId: string,
    assignedByName: string,
    assignToUserId: string,
  ) {
    const conversation = await this.convModel
      .findOne({ _id: conversationId, tenantId })
      .exec();
    if (!conversation) throw new NotFoundException("Conversation not found");

    const assignToUser = await this.userModel
      .findOne({ _id: assignToUserId, tenantId })
      .select("name email")
      .lean()
      .exec();
    if (!assignToUser) throw new NotFoundException("Team member not found");

    const contact = await this.contactModel
      .findById(conversation.contactId)
      .select("name")
      .lean()
      .exec();

    const newStatus =
      conversation.status === "RESOLVED" ? "OPEN" : conversation.status;

    await this.convModel.updateOne(
      { _id: conversationId },
      {
        $set: {
          assignedTo: assignToUserId,
          assignedAt: new Date(),
          assignedBy: assignedByUserId,
          status: newStatus,
        },
      },
    );

    await this.notificationsService.create(
      tenantId,
      assignToUserId,
      "conversation_assigned",
      "Conversation assigned to you",
      `${assignedByName} assigned you a conversation with ${contact?.name ?? "a contact"}`,
      { conversationId, assignedBy: assignedByUserId },
    );

    this.socketService.conversationUpdated(tenantId, {
      _id: conversationId,
      assignedTo: { _id: assignToUserId, name: assignToUser.name },
      assignedAt: new Date(),
      status: newStatus,
    });

    return {
      success: true,
      data: {
        message: `Conversation assigned to ${assignToUser.name}`,
        assignedTo: { _id: assignToUserId, name: assignToUser.name },
      },
    };
  }

  async unassignConversation(tenantId: string, conversationId: string) {
    const result = await this.convModel.updateOne(
      { _id: conversationId, tenantId },
      { $set: { assignedTo: null, assignedAt: null, assignedBy: null } },
    );
    if (!result.matchedCount)
      throw new NotFoundException("Conversation not found");

    this.socketService.conversationUpdated(tenantId, {
      _id: conversationId,
      assignedTo: null,
    });

    return { success: true };
  }
}
