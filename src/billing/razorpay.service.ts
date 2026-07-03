import { Injectable, Logger } from "@nestjs/common";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  async createCustomer(data: {
    name: string;
    email: string;
    phone?: string;
  }): Promise<{ id: string }> {
    const raw = await (this.razorpay.customers.create({
      name: data.name,
      email: data.email,
      contact: data.phone ?? "",
    }) as unknown as Promise<Record<string, unknown>>);
    return { id: typeof raw.id === "string" ? raw.id : String(raw.id) };
  }

  async createSubscription(data: {
    planId: string;
    customerId: string;
    totalCount: number;
    quantity: number;
    startAt?: number;
    notes?: Record<string, string>;
  }): Promise<{ id: string; short_url?: string }> {
    // customer_id is valid per Razorpay API but missing from SDK types
    const body = {
      plan_id: data.planId,
      customer_id: data.customerId,
      total_count: data.totalCount,
      quantity: data.quantity,
      start_at: data.startAt,
      notes: data.notes ?? {},
    } as Parameters<typeof this.razorpay.subscriptions.create>[0];
    const raw = await (this.razorpay.subscriptions.create(
      body,
    ) as unknown as Promise<Record<string, unknown>>);
    // Return a clean plain object so callers get a fully safe type
    return {
      id: typeof raw.id === "string" ? raw.id : String(raw.id),
      short_url: typeof raw.short_url === "string" ? raw.short_url : undefined,
    };
  }

  cancelSubscription(
    subscriptionId: string,
    cancelAtCycleEnd = true,
  ): Promise<unknown> {
    return this.razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
  }

  async fetchSubscription(
    subscriptionId: string,
  ): Promise<{ current_start?: number; current_end?: number }> {
    return this.razorpay.subscriptions.fetch(
      subscriptionId,
    ) as unknown as Promise<{ current_start?: number; current_end?: number }>;
  }

  verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
  ): boolean {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return expected === signature;
  }

  verifyPaymentSignature(data: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): boolean {
    const body = data.razorpay_subscription_id + "|" + data.razorpay_payment_id;
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");
    return expected === data.razorpay_signature;
  }
}
