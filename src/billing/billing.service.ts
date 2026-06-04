import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Subscription,
  SubscriptionDocument,
} from "../schemas/subscription.schema";
import { Invoice, InvoiceDocument } from "../schemas/invoice.schema";

export const PLAN_LIMITS = {
  TRIAL: {
    teamMembers: 10,
    contacts: 25000,
    whatsappNumbers: 2,
    aiSessions: 500,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  STARTER: {
    teamMembers: 3,
    contacts: 5000,
    whatsappNumbers: 1,
    aiSessions: 0,
    flowBuilder: false,
    aiChatbot: false,
    apiAccess: false,
  },
  GROWTH: {
    teamMembers: 10,
    contacts: 25000,
    whatsappNumbers: 2,
    aiSessions: 500,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  BUSINESS: {
    teamMembers: 25,
    contacts: 100000,
    whatsappNumbers: 5,
    aiSessions: 5000,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    teamMembers: -1,
    contacts: -1,
    whatsappNumbers: -1,
    aiSessions: -1,
    flowBuilder: true,
    aiChatbot: true,
    apiAccess: true,
  },
};

export const PLAN_PRICING = [
  {
    id: "STARTER",
    name: "Starter",
    price: 1999,
    currency: "INR",
    period: "month",
  },
  {
    id: "GROWTH",
    name: "Growth",
    price: 4999,
    currency: "INR",
    period: "month",
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 9999,
    currency: "INR",
    period: "month",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 0,
    currency: "INR",
    period: "month",
    custom: true,
  },
];

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  getPlans() {
    return PLAN_PRICING;
  }

  async getSubscription(
    tenantId: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subModel.findOne({ tenantId }).exec();
  }

  async getOrCreateSubscription(
    tenantId: string,
  ): Promise<SubscriptionDocument> {
    const existing = await this.getSubscription(tenantId);
    if (existing) return existing;

    return this.subModel.create({
      tenantId,
      plan: "TRIAL",
      status: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  async updatePlan(
    tenantId: string,
    plan: string,
  ): Promise<SubscriptionDocument> {
    return this.subModel
      .findOneAndUpdate(
        { tenantId },
        { plan, status: "ACTIVE", currentPeriodStart: new Date() },
        { new: true, upsert: true },
      )
      .exec();
  }

  async getInvoices(tenantId: string): Promise<InvoiceDocument[]> {
    return this.invoiceModel.find({ tenantId }).sort({ createdAt: -1 }).exec();
  }

  async recordInvoice(
    tenantId: string,
    subscriptionId: string,
    amount: number,
    currency: string,
  ): Promise<InvoiceDocument> {
    const number = `INV-${Date.now()}`;
    return this.invoiceModel.create({
      tenantId,
      subscriptionId,
      number,
      amount,
      currency,
      status: "paid",
      paidAt: new Date(),
    });
  }

  getPlanLimits(plan: string) {
    return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.TRIAL;
  }
}
