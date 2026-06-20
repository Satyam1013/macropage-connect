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
import { Message, MessageDocument } from "../schemas/message.schema";
import type { MessageType } from "../messages/messages.types";
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
      plan === "TRIAL" &&
      !!trialEndsAt &&
      new Date() > new Date(trialEndsAt);

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
        .findOneAndUpdate({ _id: id, tenantId }, dto, { returnDocument: "after" })
        .exec() as Promise<FlowDocument>;
    }
    return this.flowModel.create({ ...dto, tenantId });
  }

  async publishFlow(tenantId: string, id: string): Promise<FlowDocument> {
    const flow = await this.findOneFlow(tenantId, id);
    const hasStart = flow.nodes.some(
      (n) => (n as { type?: string }).type === "START",
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

  async deleteFlow(tenantId: string, id: string): Promise<void> {
    await this.flowModel.deleteOne({ _id: id, tenantId });
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
        keywords?: string[];
      };

      const matched =
        trigger.type === "inbound_message" ||
        (trigger.type === "message_contains" &&
          trigger.keywords?.some((kw) =>
            messageContent.toLowerCase().includes(kw.toLowerCase()),
          ));

      this.logger.log(
        `[Rules] rule="${rule.name}" trigger=${trigger.type} keywords=${JSON.stringify(trigger.keywords ?? [])} matched=${matched}`,
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
    const type = actions.type as string | undefined;
    const message = actions.message as string | undefined;

    this.logger.log(
      `[Rules] executeAction type=${type} hasMessage=${!!message} phone=${contactPhone}`,
    );

    if (type !== "send_message") {
      this.logger.warn(`[Rules] Unknown action type: "${type}" — skipping`);
      return;
    }
    if (!message) {
      this.logger.warn(`[Rules] action.message is empty — skipping`);
      return;
    }

    const client = await this.metaService.getClient(tenantId);
    const phone = contactPhone.replace("+", "");

    const resp = await client.sendMessage({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: message },
    });

    const metaMessageId = (
      resp.data as { messages?: Array<{ id: string }> }
    )?.messages?.[0]?.id;

    await this.msgModel.create({
      tenantId,
      conversationId,
      direction: "OUTBOUND",
      type: "TEXT" as MessageType,
      content: message,
      metaMessageId,
      status: "SENT",
      sentAt: new Date(),
    });

    this.logger.log(
      `[Rules] Auto-reply sent to ${contactPhone} in conv ${conversationId}`,
    );
  }
}
