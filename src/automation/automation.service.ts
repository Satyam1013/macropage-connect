import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AutomationRule,
  AutomationRuleDocument,
} from "../schemas/automation-rule.schema";
import { Flow, FlowDocument } from "../schemas/flow.schema";

@Injectable()
export class AutomationService {
  constructor(
    @InjectModel(AutomationRule.name)
    private readonly ruleModel: Model<AutomationRuleDocument>,
    @InjectModel(Flow.name)
    private readonly flowModel: Model<FlowDocument>,
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
    messageContent: string,
  ): Promise<void> {
    const rules = await this.ruleModel
      .find({ tenantId, isEnabled: true })
      .sort({ priority: 1 })
      .exec();

    for (const rule of rules) {
      const trigger = rule.trigger as {
        type?: string;
        keywords?: string[];
      };

      if (
        trigger.type === "message_contains" &&
        trigger.keywords?.some((kw) =>
          messageContent.toLowerCase().includes(kw.toLowerCase()),
        )
      ) {
        await this.ruleModel.updateOne(
          { _id: rule._id },
          { $inc: { totalTriggered: 1 }, lastTriggeredAt: new Date() },
        );
      }
    }
  }
}
