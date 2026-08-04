import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PLAN_LIMITS, PLAN_PRICING } from "./billing.constants";
import {
  Subscription,
  SubscriptionDocument,
} from "../schemas/subscription.schema";
import { Invoice, InvoiceDocument } from "../schemas/invoice.schema";
import { Payment, PaymentDocument } from "../schemas/payment.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import {
  PlanOverride,
  PlanOverrideDocument,
} from "./schemas/plan-override.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { RazorpayService } from "./razorpay.service";
import type { BillingCycle, PlanKey } from "./billing.types";
import { getPlanPricing } from "./plans.config";
import { UpdatePlanDto } from "./dto/update-plan.dto";

function mergePlan(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return Object.entries(changes).reduce<Record<string, unknown>>(
    (result, [key, value]) => {
      const existing = result[key];
      result[key] =
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing)
          ? mergePlan(
              existing as Record<string, unknown>,
              value as Record<string, unknown>,
            )
          : value;
      return result;
    },
    { ...current },
  );
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(PlanOverride.name)
    private readonly planOverrideModel: Model<PlanOverrideDocument>,
    private readonly razorpayService: RazorpayService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Public plans list ─────────────────────────────────────────────────────

  /** Merges macropage-admin's pricing-page edits (adminplanoverrides) onto the static catalog. */
  async getPlans() {
    const overrides = await this.planOverrideModel.find().lean().exec();
    if (overrides.length === 0) {
      return PLAN_PRICING;
    }
    const overridesByPlanId = new Map(
      overrides.map((override) => [override.planId, override.plan]),
    );
    return PLAN_PRICING.map((plan) =>
      overridesByPlanId.has(plan.id)
        ? (mergePlan(
            plan as unknown as Record<string, unknown>,
            overridesByPlanId.get(plan.id)!,
          ) as unknown as (typeof PLAN_PRICING)[number])
        : plan,
    );
  }

  /** Platform-staff pricing-page edit — writes to adminplanoverrides. */
  async updatePlanOverride(planId: string, dto: UpdatePlanDto) {
    const defaultPlan = PLAN_PRICING.find((plan) => plan.id === planId);
    if (!defaultPlan) {
      throw new NotFoundException("Plan not found");
    }

    const existingOverride = await this.planOverrideModel
      .findOne({ planId })
      .lean()
      .exec();
    const plan = mergePlan(
      (existingOverride?.plan ??
        (defaultPlan as unknown as Record<string, unknown>)) as Record<
        string,
        unknown
      >,
      dto as Record<string, unknown>,
    );

    const updatedOverride = await this.planOverrideModel
      .findOneAndUpdate(
        { planId },
        { $set: { plan } },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();

    return updatedOverride!.plan;
  }

  /**
   * Platform-staff triage: a tenant's plan history. Payment docs only exist
   * for actual purchases — a tenant still on the free TRIAL plan has none,
   * so synthesize a TRIAL entry from the Subscription doc (every tenant has
   * one) so the free plan and its period still show up.
   */
  async getPlanHistoryForPlatform(tenantId: string) {
    const [payments, subscription] = await Promise.all([
      this.paymentModel.find({ tenantId }).sort({ createdAt: -1 }).lean().exec(),
      this.subModel.findOne({ tenantId }).lean().exec(),
    ]);

    if (!subscription) {
      return payments;
    }

    const trialEntry = {
      tenantId,
      plan: "TRIAL",
      status: subscription.status,
      amount: 0,
      currency: "INR",
      periodStart: subscription.currentPeriodStart ?? subscription.createdAt,
      periodEnd: subscription.trialEndsAt ?? subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
      isFreePlan: true,
    };

    return [...payments, trialEntry];
  }

  // ── Subscription read ─────────────────────────────────────────────────────

  async getSubscription(
    tenantId: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subModel.findOne({ tenantId }).exec();
  }

  countActiveSubscriptions() {
    return this.subModel.countDocuments({ status: "ACTIVE" }).exec();
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

  // ── Create Razorpay subscription ──────────────────────────────────────────

  async createRazorpaySubscription(
    tenantId: string,
    userId: string,
    plan: PlanKey,
    billingCycle: BillingCycle,
  ) {
    const pricing = getPlanPricing(plan, billingCycle);
    if (!pricing?.razorpayPlanId) {
      throw new BadRequestException(
        "Invalid plan or billing cycle — Razorpay plan ID not configured",
      );
    }

    const user = await this.userModel
      .findById(userId)
      .select("name email phone")
      .lean()
      .exec();
    if (!user) throw new NotFoundException("User not found");

    const sub = await this.subModel.findOne({ tenantId }).lean().exec();
    let razorpayCustomerId = sub?.razorpayCustomerId;

    if (!razorpayCustomerId) {
      const customer = await this.razorpayService.createCustomer({
        name: user.name,
        email: user.email,
        phone: user.phone,
      });
      razorpayCustomerId = String(customer.id);
    }

    const totalCount =
      billingCycle === "yearly" ? 10 : billingCycle === "quarterly" ? 40 : 120;

    // Explicit type annotation breaks ESLint's unsafe-assignment taint from the SDK cast
    const rzpSub: { id: string; short_url?: string } =
      await this.razorpayService.createSubscription({
        planId: pricing.razorpayPlanId,
        customerId: razorpayCustomerId,
        totalCount,
        quantity: 1,
        notes: { tenantId, plan, billingCycle },
      });
    const rzpSubId: string = rzpSub.id;
    const rzpShortUrl: string | null = rzpSub.short_url ?? null;

    await this.subModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          plan,
          billingCycle,
          status: "TRIALING",
          razorpaySubId: rzpSubId,
          razorpayCustomerId,
          razorpayPlanId: pricing.razorpayPlanId,
        },
      },
      { upsert: true, new: true },
    );

    await this.userModel.updateMany(
      { tenantId },
      { $set: { billingPlan: plan, billingCycle } },
    );

    this.logger.log(
      `[Billing] Created subscription ${rzpSubId} for tenant ${tenantId}`,
    );

    return {
      success: true,
      data: {
        subscriptionId: rzpSubId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        plan,
        billingCycle,
        amount: pricing.amount,
        currency: "INR",
        shortUrl: rzpShortUrl,
      },
    };
  }

  // ── Verify payment after Razorpay checkout ────────────────────────────────

  async verifyPayment(
    tenantId: string,
    userId: string,
    data: {
      razorpay_subscription_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    },
  ) {
    const isValid = this.razorpayService.verifyPaymentSignature(data);
    if (!isValid) {
      throw new BadRequestException(
        "Payment verification failed — invalid signature",
      );
    }

    const sub = await this.subModel
      .findOne({ tenantId, razorpaySubId: data.razorpay_subscription_id })
      .exec();
    if (!sub) throw new NotFoundException("Subscription not found");

    const rzpSub = await this.razorpayService.fetchSubscription(
      data.razorpay_subscription_id,
    );

    const periodStart = new Date(
      ((rzpSub as unknown as Record<string, number>).current_start ?? 0) * 1000,
    );
    const periodEnd = new Date(
      ((rzpSub as unknown as Record<string, number>).current_end ?? 0) * 1000,
    );

    await this.subModel.updateOne(
      { tenantId },
      {
        $set: {
          status: "ACTIVE",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
      },
    );

    await this.syncUserPlan(tenantId, sub.plan);

    // Save payment record (idempotent)
    const exists = await this.paymentModel
      .findOne({ razorpayPaymentId: data.razorpay_payment_id })
      .lean()
      .exec();

    if (!exists) {
      const pricing = getPlanPricing(
        sub.plan as PlanKey,
        (sub.billingCycle ?? "monthly") as BillingCycle,
      );
      await this.paymentModel.create({
        tenantId,
        razorpayPaymentId: data.razorpay_payment_id,
        razorpaySubscriptionId: data.razorpay_subscription_id,
        amount: pricing?.amount ?? 0,
        currency: "INR",
        status: "success",
        plan: sub.plan,
        billingCycle: sub.billingCycle,
      });
    }

    await this.notificationsService.create(
      tenantId,
      userId,
      "payment_success",
      `${sub.plan} plan activated ✅`,
      `Your ${sub.billingCycle} ${sub.plan} subscription is now active.`,
    );

    this.logger.log(
      `[Billing] Payment verified for tenant ${tenantId}, plan ${sub.plan}`,
    );

    return {
      success: true,
      data: {
        message: "Payment verified — plan activated",
        plan: sub.plan,
        billingCycle: sub.billingCycle,
        currentPeriodEnd: periodEnd,
      },
    };
  }

  // ── Cancel subscription ───────────────────────────────────────────────────

  async cancelSubscription(
    tenantId: string,
    userId: string,
    cancelImmediately = false,
  ) {
    const sub = await this.subModel.findOne({ tenantId }).exec();
    if (!sub?.razorpaySubId) {
      throw new NotFoundException("No active subscription found");
    }

    await this.razorpayService.cancelSubscription(
      sub.razorpaySubId,
      !cancelImmediately,
    );

    await this.subModel.updateOne(
      { tenantId },
      {
        $set: {
          cancelledAt: new Date(),
          cancelAtPeriodEnd: !cancelImmediately,
          status: cancelImmediately ? "CANCELLED" : sub.status,
        },
      },
    );

    const msg = cancelImmediately
      ? "Your subscription has been cancelled immediately."
      : "Your subscription will cancel at the end of the current billing period.";

    await this.notificationsService.create(
      tenantId,
      userId,
      "plan_changed",
      "Subscription cancelled",
      msg,
    );

    return {
      success: true,
      data: {
        message: cancelImmediately
          ? "Subscription cancelled immediately"
          : "Subscription will cancel at period end",
        cancelAtPeriodEnd: !cancelImmediately,
      },
    };
  }

  // ── Payment history ───────────────────────────────────────────────────────

  async getPaymentHistory(tenantId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      this.paymentModel
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.paymentModel.countDocuments({ tenantId }),
    ]);
    return { success: true, data: { payments, total, page, limit } };
  }

  // ── Webhook handler ───────────────────────────────────────────────────────

  async handleWebhook(event: string, payload: unknown): Promise<void> {
    const p = payload as Record<string, Record<string, unknown>>;
    const sub = p?.subscription?.entity as Record<string, unknown> | undefined;
    const payment = p?.payment?.entity as Record<string, unknown> | undefined;

    this.logger.log(`[Webhook] event=${event}`);

    switch (event) {
      case "subscription.activated": {
        if (!sub) break;
        await this.subModel.updateOne(
          { razorpaySubId: sub.id as string },
          {
            $set: {
              status: "ACTIVE",
              currentPeriodStart: new Date(
                (sub.current_start as number) * 1000,
              ),
              currentPeriodEnd: new Date((sub.current_end as number) * 1000),
            },
          },
        );
        const activatedSub = await this.subModel
          .findOne({ razorpaySubId: sub.id as string })
          .lean()
          .exec();
        if (activatedSub) {
          await this.syncUserPlan(activatedSub.tenantId, activatedSub.plan);
        }
        break;
      }

      case "subscription.charged": {
        if (!sub || !payment) break;
        const tenantId = (sub.notes as Record<string, string>)?.tenantId;
        if (!tenantId) break;

        // Idempotent payment save
        const exists = await this.paymentModel
          .findOne({ razorpayPaymentId: payment.id as string })
          .lean()
          .exec();

        if (!exists) {
          await this.paymentModel.create({
            tenantId,
            razorpayPaymentId: String(payment.id),
            razorpaySubscriptionId: String(sub.id),
            amount: Number(payment.amount),
            currency:
              typeof payment.currency === "string" ? payment.currency : "INR",
            status: "success",
            razorpayPayload: payload as Record<string, unknown>,
          });
        }

        await this.subModel.updateOne(
          { razorpaySubId: sub.id as string },
          {
            $set: {
              status: "ACTIVE",
              currentPeriodEnd: new Date((sub.current_end as number) * 1000),
            },
          },
        );

        // Notify owner
        const dbSub = await this.subModel
          .findOne({ razorpaySubId: sub.id as string })
          .lean()
          .exec();
        if (dbSub) {
          await this.syncUserPlan(dbSub.tenantId, dbSub.plan);

          // tenantId is always the owner's own _id — invited team members are
          // the only users that ever get a distinct `tenantId` field stored.
          const owner = await this.userModel
            .findById(dbSub.tenantId)
            .select("_id")
            .lean()
            .exec();
          if (owner) {
            void this.notificationsService.create(
              dbSub.tenantId,
              String(owner._id),
              "payment_success",
              "Payment received ✅",
              `Your ${dbSub.billingCycle} ${dbSub.plan} plan has been renewed.`,
            );
          }
        }
        break;
      }

      case "subscription.payment_failed": {
        if (!sub) break;
        await this.subModel.updateOne(
          { razorpaySubId: sub.id as string },
          { $set: { status: "PAST_DUE", paymentFailedAt: new Date() } },
        );

        const dbSub = await this.subModel
          .findOne({ razorpaySubId: sub.id as string })
          .lean()
          .exec();
        if (dbSub) {
          const owner = await this.userModel
            .findById(dbSub.tenantId)
            .select("_id")
            .lean()
            .exec();
          if (owner) {
            void this.notificationsService.create(
              dbSub.tenantId,
              String(owner._id),
              "payment_failed",
              "Payment failed ⚠️",
              "Your subscription payment failed. Please update your payment method.",
            );
          }
        }
        break;
      }

      case "subscription.cancelled": {
        if (!sub) break;
        await this.subModel.updateOne(
          { razorpaySubId: sub.id as string },
          { $set: { status: "CANCELLED", cancelledAt: new Date() } },
        );
        break;
      }

      default:
        this.logger.log(`[Webhook] Unhandled event: ${event}`);
    }
  }

  // ── Sync plan fields back to User documents ──────────────────────────────

  private async syncUserPlan(tenantId: string, subPlan: string): Promise<void> {
    const isPaid = ["STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"].includes(
      subPlan,
    );
    const subscriptionType =
      subPlan === "BUSINESS" || subPlan === "ENTERPRISE"
        ? "business"
        : isPaid
          ? "pro"
          : "free";

    // tenantId identifies a tenant as "owner's own _id" everywhere in this
    // app (req.user.tenantId ?? req.user.id), but the owner's own user doc
    // never has a tenantId field set on itself — only team members do. A
    // bare { tenantId } filter therefore updates every team member but
    // skips the owner entirely, which is who actually pays.
    const update: Record<string, unknown> = {
      plan: isPaid ? "PRO" : "FREE",
      billingPlan: subPlan,
      subscriptionType,
      paidUser: isPaid,
    };
    // A real paid plan supersedes any trial state — otherwise the
    // trial-countdown banner keeps showing after upgrading.
    if (isPaid) update.trialEndsAt = null;

    await this.userModel.updateMany(
      { $or: [{ tenantId }, { _id: tenantId }] },
      { $set: update },
    );
    this.logger.log(
      `[Billing] Synced users for tenant ${tenantId} → plan=${subPlan}`,
    );
  }

  // ── Payment method ────────────────────────────────────────────────────────

  async getPaymentMethod(tenantId: string) {
    const sub = await this.subModel
      .findOne({ tenantId })
      .select("razorpaySubId razorpayCustomerId plan billingCycle status")
      .lean()
      .exec();

    if (!sub?.razorpaySubId) {
      return { success: true, data: { paymentMethod: null } };
    }

    let rzpSub: Record<string, unknown> = {};
    try {
      rzpSub = await this.razorpayService.fetchSubscription(sub.razorpaySubId);
    } catch {
      return { success: true, data: { paymentMethod: null } };
    }

    const paymentMethod = rzpSub.payment_method as string | undefined;
    const bankAccount = rzpSub.bank_account as
      | Record<string, unknown>
      | undefined;

    return {
      success: true,
      data: {
        paymentMethod: paymentMethod ?? null,
        bankAccount: bankAccount ?? null,
        subscriptionId: sub.razorpaySubId,
        customerId: sub.razorpayCustomerId ?? null,
        plan: sub.plan,
        billingCycle: sub.billingCycle ?? null,
        status: sub.status,
      },
    };
  }

  // ── Legacy helpers (used by other modules) ────────────────────────────────

  async updatePlan(
    tenantId: string,
    plan: string,
  ): Promise<SubscriptionDocument> {
    return this.subModel
      .findOneAndUpdate(
        { tenantId },
        { plan, status: "ACTIVE", currentPeriodStart: new Date() },
        { returnDocument: "after", upsert: true },
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
    return this.invoiceModel.create({
      tenantId,
      subscriptionId,
      number: `INV-${Date.now()}`,
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
