import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AutomationRule,
  AutomationRuleDocument,
} from "../schemas/automation-rule.schema";
import { Flow, FlowDocument } from "../schemas/flow.schema";
import { ConversationsService } from "../conversations/conversations.service";
import { MetaService } from "../meta/meta.service";
import { SocketService } from "../gateway/socket.service";
import { Message, MessageDocument } from "../schemas/message.schema";
import { BillingService } from "../billing/billing.service";
import { getPlanLimits } from "./plan-limits.config";

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    @InjectModel(AutomationRule.name)
    private readonly ruleModel: Model<AutomationRuleDocument>,
    @InjectModel(Flow.name)
    private readonly flowModel: Model<FlowDocument>,
    @InjectModel(Message.name)
    private readonly msgModel: Model<MessageDocument>,
    private readonly conversationsService: ConversationsService,
    private readonly metaService: MetaService,
    private readonly socketService: SocketService,
    private readonly billingService: BillingService,
  ) {}

  // ─── Rules ────────────────────────────────────────────────────────────────

  async findAllRules(tenantId: string) {
    return this.ruleModel
      .find({ tenantId })
      .sort({ priority: 1, createdAt: -1 })
      .exec();
  }

  async createRule(
    tenantId: string,
    dto: Partial<AutomationRule>,
  ): Promise<AutomationRuleDocument> {
    return this.ruleModel.create({ ...dto, tenantId });
  }

  async updateRule(
    tenantId: string,
    id: string,
    dto: Partial<AutomationRule>,
  ): Promise<AutomationRuleDocument> {
    const rule = await this.ruleModel
      .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
      .exec();
    if (!rule) throw new NotFoundException("Rule not found");
    return rule;
  }

  async toggleRule(
    tenantId: string,
    id: string,
    enabled: boolean,
  ): Promise<void> {
    await this.ruleModel.updateOne(
      { _id: id, tenantId },
      { isEnabled: enabled },
    );
  }

  async deleteRule(tenantId: string, id: string): Promise<void> {
    await this.ruleModel.deleteOne({ _id: id, tenantId });
  }

  async countCustomRules(tenantId: string): Promise<number> {
    return this.ruleModel.countDocuments({ tenantId, isBuiltIn: false });
  }

  async getAutomationLimits(tenantId: string) {
    const sub = await this.billingService.getSubscription(tenantId);
    const plan = sub?.plan ?? "STARTER";
    const trialEndsAt = sub?.trialEndsAt ?? null;

    const limits = getPlanLimits({ plan, trialEndsAt });
    const currentRuleCount = await this.countCustomRules(tenantId);

    const isExpiredTrial =
      plan === "TRIAL" && !!trialEndsAt && new Date() > new Date(trialEndsAt);

    return {
      success: true,
      data: {
        plan,
        trialEndsAt,
        isExpiredTrial,
        rulesEnabled: limits.rulesEnabled,
        flowsEnabled: limits.flowsEnabled,
        aiEnabled: limits.aiEnabled,
        maxCustomRules: limits.maxCustomRules,
        currentRuleCount,
      },
    };
  }

  // ─── Flows ────────────────────────────────────────────────────────────────

  async findAllFlows(tenantId: string) {
    return this.flowModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
  }

  async findOneFlow(tenantId: string, id: string): Promise<FlowDocument> {
    const flow = await this.flowModel.findOne({ _id: id, tenantId }).exec();
    if (!flow) throw new NotFoundException("Flow not found");
    return flow;
  }

  async saveFlow(
    tenantId: string,
    id: string | undefined,
    dto: Partial<Flow>,
  ): Promise<FlowDocument> {
    if (id) {
      return this.flowModel
        .findOneAndUpdate({ _id: id, tenantId }, dto, {
          returnDocument: "after",
        })
        .exec() as Promise<FlowDocument>;
    }
    return this.flowModel.create({ ...dto, tenantId });
  }

  async publishFlow(tenantId: string, id: string): Promise<FlowDocument> {
    const flow = await this.findOneFlow(tenantId, id);
    const hasStart = flow.nodes.some(
      (n) => (n as { type?: string }).type?.toUpperCase() === "START",
    );
    if (!hasStart) throw new NotFoundException("Flow must have a START node");
    return this.flowModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { status: "active" },
        { returnDocument: "after" },
      )
      .exec() as Promise<FlowDocument>;
  }

  async toggleFlow(tenantId: string, id: string): Promise<FlowDocument> {
    const flow = await this.findOneFlow(tenantId, id);
    const next = flow.status === "active" ? "inactive" : "active";
    return this.flowModel
      .findOneAndUpdate(
        { _id: id, tenantId },
        { status: next },
        { returnDocument: "after" },
      )
      .exec() as Promise<FlowDocument>;
  }

  async deleteFlow(tenantId: string, id: string): Promise<void> {
    await this.flowModel.deleteOne({ _id: id, tenantId });
  }

  // ─── Debug ────────────────────────────────────────────────────────────────

  async debugRules(tenantId: string) {
    const all = await this.ruleModel.find({ tenantId }).lean().exec();
    const enabled = all.filter((r) => r.isEnabled);

    return {
      tenantId,
      totalRules: all.length,
      enabledRules: enabled.length,
      rules: all.map((r) => ({
        id: r._id,
        name: r.name,
        isEnabled: r.isEnabled,
        trigger: r.trigger,
        actions: r.actions,
        triggerType:
          (r.trigger as { type?: string; event?: string })?.type ??
          (r.trigger as { event?: string })?.event ??
          "UNKNOWN",
        actionType: Array.isArray(r.actions)
          ? (r.actions[0] as { type?: string })?.type
          : ((r.actions as { type?: string })?.type ?? "UNKNOWN"),
        actionMessage: Array.isArray(r.actions)
          ? ((r.actions[0] as { message?: string; text?: string })?.message ??
            (r.actions[0] as { text?: string })?.text)
          : ((r.actions as { message?: string })?.message ?? "MISSING"),
      })),
    };
  }

  // ─── Rule Processing ──────────────────────────────────────────────────────

  async processRules(
    tenantId: string,
    conversationId: string,
    contactPhone: string,
    messageContent: string,
  ): Promise<void> {
    const rules = await this.ruleModel
      .find({ tenantId, isEnabled: true })
      .sort({ priority: 1 })
      .exec();

    this.logger.log(
      `[Rules] tenant=${tenantId} found=${rules.length} rules, msg="${messageContent}"`,
    );

    if (!rules.length) return;

    for (const rule of rules) {
      const trigger = rule.trigger as {
        type?: string;
        event?: string;
        keywords?: string[] | string;
        keyword?: string;
        words?: string;
        config?: { keywords?: string[] | string; keyword?: string };
      };

      const triggerType = (trigger.type ?? trigger.event ?? "").toLowerCase();

      // Keywords can live at trigger root OR inside trigger.config (frontend stores them in config)
      const rawKeywords: unknown =
        trigger.keywords ??
        trigger.keyword ??
        trigger.words ??
        trigger.config?.keywords ??
        trigger.config?.keyword ??
        [];
      const keywordList: string[] = Array.isArray(rawKeywords)
        ? (rawKeywords as string[])
        : String(rawKeywords as string)
            .split(/\s+OR\s+|,/)
            .map((k) => k.replace(/['"]/g, "").trim())
            .filter(Boolean);

      // Only "inbound_message"/"all"/"any" types match every message.
      // "message" and "message_contains" REQUIRE keywords — skip if none defined.
      const isMatchAll =
        triggerType === "inbound_message" ||
        triggerType === "all" ||
        triggerType === "any";

      const isKeywordTrigger =
        (triggerType === "message_contains" ||
          triggerType === "message_contains_keywords" ||
          triggerType === "keyword" ||
          triggerType === "contains" ||
          triggerType === "keywords" ||
          triggerType === "message") &&
        keywordList.length > 0;

      const keywordsMatch = keywordList.some((kw) =>
        messageContent.toLowerCase().includes(kw.toLowerCase()),
      );

      const matched = isMatchAll || (isKeywordTrigger && keywordsMatch);

      this.logger.log(
        `[Rules] rule="${rule.name}" triggerType=${triggerType} keywords=${JSON.stringify(keywordList)} matched=${matched} raw=${JSON.stringify(trigger)}`,
      );

      if (!matched) continue;

      await this.ruleModel.updateOne(
        { _id: rule._id },
        { $inc: { totalTriggered: 1 }, lastTriggeredAt: new Date() },
      );

      await this.executeAction(
        tenantId,
        conversationId,
        contactPhone,
        rule.actions,
      ).catch((err: unknown) =>
        this.logger.error(`[Rules] Action failed for rule "${rule.name}"`, err),
      );
    }
  }

  private async executeAction(
    tenantId: string,
    conversationId: string,
    contactPhone: string,
    actions: Record<string, unknown>,
  ): Promise<void> {
    // Support both object { type, message } and array [{ type, message }] formats
    const action: Record<string, unknown> = Array.isArray(actions)
      ? ((actions[0] as Record<string, unknown>) ?? {})
      : actions;

    // action.type or action.config.type (frontend stores type in both places)
    const cfg = (action.config ?? {}) as Record<string, unknown>;
    const type = (action.type ?? action.actionType ?? cfg.type) as
      | string
      | undefined;
    // message lives at action.message OR action.config.message
    const message = (action.message ??
      action.text ??
      action.body ??
      cfg.message ??
      cfg.text ??
      cfg.body) as string | undefined;

    this.logger.log(
      `[Rules] executeAction raw=${JSON.stringify(actions)} type=${type} hasMessage=${!!message} phone=${contactPhone}`,
    );

    const isSendMessage =
      type === "send_message" ||
      type === "reply" ||
      type === "send_text" ||
      type === "text";

    if (!isSendMessage) {
      this.logger.warn(`[Rules] Unknown action type: "${type}" — skipping`);
      return;
    }
    if (!message) {
      this.logger.warn(`[Rules] action.message is empty — skipping`);
      return;
    }

    // Save first so auto-reply is always visible in portal
    const savedMsg = await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: message,
      status: "PENDING",
      sentAt: new Date(),
    });

    const basePayload = {
      _id: String(savedMsg._id),
      conversationId,
      tenantId,
      direction: "OUTBOUND",
      type: "TEXT",
      content: message,
      isNote: false,
      agent: null,
      sentAt: savedMsg.sentAt,
      createdAt: savedMsg.createdAt,
    };

    // Show auto-reply in portal immediately
    this.socketService.newMessage(tenantId, {
      ...basePayload,
      status: "PENDING",
    });

    try {
      const client = await this.metaService.getClient(tenantId);
      const phone = contactPhone.replace("+", "");

      const resp = await client.sendMessage({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: message },
      });

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

      this.logger.log(
        `[Rules] Auto-reply SENT to ${contactPhone} in conv ${conversationId}`,
      );
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
      this.logger.error(
        `[Rules] Auto-reply FAILED to ${contactPhone} in conv ${conversationId}`,
        err,
      );
      throw err;
    }
  }
}
