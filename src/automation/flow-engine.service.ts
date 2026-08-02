import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Flow, FlowDocument } from "../schemas/flow.schema";
import { Message, MessageDocument } from "../schemas/message.schema";
import {
  Conversation,
  ConversationDocument,
} from "../schemas/conversation.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { MetaService } from "../meta/meta.service";
import { SocketService } from "../gateway/socket.service";

interface FlowNodeData {
  nodeType?: string;
  config?: {
    text?: string;
    buttons?: string[];
  };
}

interface FlowNode {
  id: string;
  type?: string;
  data?: FlowNodeData;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface ConversationFlowState {
  id: string;
  activeFlowId?: string | null;
  activeFlowNodeId?: string | null;
}

// Guards against a cyclic flow graph looping forever within one request.
const MAX_HOPS = 25;

@Injectable()
export class FlowEngineService {
  private readonly logger = new Logger(FlowEngineService.name);

  constructor(
    @InjectModel(Flow.name)
    private readonly flowModel: Model<FlowDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly metaService: MetaService,
    private readonly socketService: SocketService,
  ) {}

  // ─── Entry points ───────────────────────────────────────────────────────

  async startFlow(
    tenantId: string,
    flowId: string,
    conversationId: string,
    contactId: string,
    contactPhone: string,
  ): Promise<void> {
    const flow = await this.flowModel.findOne({ _id: flowId, tenantId }).exec();
    if (!flow) {
      this.logger.warn(`[Flow] start_flow: flow ${flowId} not found`);
      return;
    }
    if (flow.status !== "active") {
      this.logger.warn(
        `[Flow] start_flow: flow ${flowId} is not active (status=${flow.status}) — skipping`,
      );
      return;
    }

    const nodes = flow.nodes as unknown as FlowNode[];
    const startNode = nodes.find((n) => this.nodeType(n) === "start");
    if (!startNode) {
      this.logger.warn(`[Flow] flow ${flowId} has no start node — skipping`);
      return;
    }

    const firstEdge = this.findEdge(flow, startNode.id, null);
    if (!firstEdge) {
      this.logger.warn(
        `[Flow] start node has no outgoing edge in flow ${flowId} — skipping`,
      );
      return;
    }

    await this.flowModel.updateOne(
      { _id: flow._id },
      { $inc: { totalTriggered: 1 } },
    );

    await this.runFrom(
      tenantId,
      flow,
      firstEdge.target,
      conversationId,
      contactId,
      contactPhone,
    );
  }

  // Returns true if the reply was consumed by an in-progress flow (caller
  // should NOT also run automation rules for this message).
  async resumeFlow(
    tenantId: string,
    conversation: ConversationFlowState,
    contactId: string,
    contactPhone: string,
    messageContent: string,
    buttonReplyId?: string,
  ): Promise<boolean> {
    if (!conversation.activeFlowId || !conversation.activeFlowNodeId) {
      return false;
    }

    const flow = await this.flowModel
      .findOne({ _id: conversation.activeFlowId, tenantId })
      .exec();
    if (!flow || flow.status !== "active") {
      await this.clearFlowState(tenantId, conversation.id);
      return false;
    }

    const nodes = flow.nodes as unknown as FlowNode[];
    const waitingNode = nodes.find(
      (n) => n.id === conversation.activeFlowNodeId,
    );
    if (!waitingNode) {
      await this.clearFlowState(tenantId, conversation.id);
      return false;
    }

    const buttons = waitingNode.data?.config?.buttons ?? [];
    const matchedIdx = this.matchButtonReply(
      buttons,
      buttonReplyId,
      messageContent,
    );

    if (matchedIdx === -1) {
      // Off-script reply — stay in the flow and reprompt the same node
      // rather than cancelling (per product decision: bot doesn't hand
      // off to a human just because a reply didn't match a button).
      await this.sendMessageNode(
        tenantId,
        contactId,
        contactPhone,
        conversation.id,
        waitingNode,
      );
      return true;
    }

    const edge = this.findEdge(flow, waitingNode.id, `btn-${matchedIdx}`);
    if (!edge) {
      this.logger.warn(
        `[Flow] node ${waitingNode.id} has no edge for btn-${matchedIdx} — ending flow ${flow.id}`,
      );
      await this.clearFlowState(tenantId, conversation.id);
      return true;
    }

    await this.runFrom(
      tenantId,
      flow,
      edge.target,
      conversation.id,
      contactId,
      contactPhone,
    );
    return true;
  }

  // ─── Chain execution ────────────────────────────────────────────────────

  private async runFrom(
    tenantId: string,
    flow: FlowDocument,
    startNodeId: string,
    conversationId: string,
    contactId: string,
    contactPhone: string,
  ): Promise<void> {
    const nodes = flow.nodes as unknown as FlowNode[];
    let currentId: string | undefined = startNodeId;
    let hops = 0;

    while (currentId) {
      if (++hops > MAX_HOPS) {
        this.logger.error(
          `[Flow] flow ${flow.id} exceeded ${MAX_HOPS} hops — possible cycle, aborting`,
        );
        await this.clearFlowState(tenantId, conversationId);
        return;
      }

      const node = nodes.find((n) => n.id === currentId);
      if (!node) {
        this.logger.warn(
          `[Flow] node ${currentId} not found in flow ${flow.id} — ending flow`,
        );
        await this.clearFlowState(tenantId, conversationId);
        return;
      }

      const type = this.nodeType(node);

      if (type === "end") {
        await this.clearFlowState(tenantId, conversationId);
        return;
      }

      if (type === "message") {
        await this.sendMessageNode(
          tenantId,
          contactId,
          contactPhone,
          conversationId,
          node,
        );

        const buttons = node.data?.config?.buttons ?? [];
        if (buttons.length > 0) {
          // Waits for the contact's button reply — resumeFlow() picks up
          // execution from here.
          await this.convModel.updateOne(
            { _id: conversationId, tenantId },
            { activeFlowId: String(flow._id), activeFlowNodeId: node.id },
          );
          return;
        }

        const nextEdge =
          this.findEdge(flow, node.id, "continue") ??
          this.findEdge(flow, node.id, null);
        if (!nextEdge) {
          await this.clearFlowState(tenantId, conversationId);
          return;
        }
        currentId = nextEdge.target;
        continue;
      }

      this.logger.warn(
        `[Flow] unsupported node type "${type}" (node ${node.id}) in flow ${flow.id} — ending flow`,
      );
      await this.clearFlowState(tenantId, conversationId);
      return;
    }
  }

  private async sendMessageNode(
    tenantId: string,
    contactId: string,
    contactPhone: string,
    conversationId: string,
    node: FlowNode,
  ): Promise<void> {
    const cfg = node.data?.config ?? {};
    if (!cfg.text) {
      this.logger.warn(`[Flow] message node ${node.id} has no text — skipping`);
      return;
    }

    const contact = await this.contactModel
      .findOne({ _id: contactId, tenantId })
      .lean()
      .exec();
    const text = this.interpolate(cfg.text, contact);
    const buttons = cfg.buttons ?? [];

    const savedMsg = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: text,
      status: "PENDING",
      sentAt: new Date(),
    });

    const basePayload = {
      _id: String(savedMsg._id),
      conversationId,
      tenantId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: text,
      isNote: false,
      agent: null,
      sentAt: savedMsg.sentAt,
      createdAt: savedMsg.createdAt,
    };

    this.socketService.newMessage(tenantId, {
      ...basePayload,
      status: "PENDING",
    });

    try {
      const client = await this.metaService.getClient(tenantId);
      const phone = contactPhone.replace("+", "");

      const payload =
        buttons.length > 0
          ? {
              messaging_product: "whatsapp",
              to: phone,
              type: "interactive",
              interactive: {
                type: "button",
                body: { text },
                action: {
                  buttons: buttons.slice(0, 3).map((label, idx) => ({
                    type: "reply",
                    reply: { id: `btn-${idx}`, title: label.slice(0, 20) },
                  })),
                },
              },
            }
          : {
              messaging_product: "whatsapp",
              to: phone,
              type: "text",
              text: { body: text },
            };

      const resp = await client.sendMessage(payload);
      const metaMessageId = (resp.data as { messages?: Array<{ id: string }> })
        ?.messages?.[0]?.id;

      await this.msgModel.updateOne(
        { _id: savedMsg._id },
        { status: "SENT", metaMessageId },
      );
      this.socketService.newMessage(tenantId, {
        ...basePayload,
        status: "SENT",
        metaMessageId: metaMessageId ?? null,
        _update: true,
      });
    } catch (err: unknown) {
      await this.msgModel.updateOne(
        { _id: savedMsg._id },
        { status: "FAILED" },
      );
      this.socketService.newMessage(tenantId, {
        ...basePayload,
        status: "FAILED",
        _update: true,
      });
      this.logger.error(`[Flow] send failed for node ${node.id}`, err);
      throw err;
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private nodeType(node: FlowNode): string {
    return (node.data?.nodeType ?? node.type ?? "").toLowerCase();
  }

  private findEdge(
    flow: FlowDocument,
    sourceId: string,
    handle: string | null,
  ): FlowEdge | undefined {
    const edges = flow.edges as unknown as FlowEdge[];
    return edges.find(
      (e) =>
        e.source === sourceId &&
        (handle === null ? !e.sourceHandle : e.sourceHandle === handle),
    );
  }

  private matchButtonReply(
    buttons: string[],
    buttonReplyId: string | undefined,
    messageContent: string,
  ): number {
    if (buttonReplyId) {
      const m = /^btn-(\d+)$/.exec(buttonReplyId);
      if (m) {
        const idx = Number(m[1]);
        if (idx >= 0 && idx < buttons.length) return idx;
      }
    }
    const byLabel = buttons.findIndex(
      (b) => b.trim().toLowerCase() === messageContent.trim().toLowerCase(),
    );
    return byLabel;
  }

  private interpolate(
    text: string,
    contact: { name?: string; phone?: string; email?: string } | null,
  ): string {
    return text.replace(/\{\{\s*contact\.(\w+)\s*\}\}/g, (_match, key) => {
      const value = contact?.[key as keyof typeof contact];
      return value != null ? String(value) : "";
    });
  }

  private async clearFlowState(
    tenantId: string,
    conversationId: string,
  ): Promise<void> {
    await this.convModel.updateOne(
      { _id: conversationId, tenantId },
      { activeFlowId: null, activeFlowNodeId: null },
    );
  }
}
