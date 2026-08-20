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
import { Plan, PlanDocument } from "./schemas/plan.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { RazorpayService } from "./razorpay.service";
import type { BillingCycle, Plan as PlanValue, PlanKey } from "./billing.types";
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
    @InjectModel(Plan.name)
    private readonly planModel: Model<PlanDocument>,
    private readonly razorpayService: RazorpayService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Public plans list ─────────────────────────────────────────────────────

  /** DB (the `plans` collection) is the source of truth once seeded; falls back to the static catalog otherwise. */
  async getPlans() {
    const plans = await this.planModel.find().lean().exec();
    if (plans.length === 0) {
      return PLAN_PRICING;
    }
    const planById = new Map(plans.map((p) => [p.planId, p.plan]));
    return PLAN_PRICING.map(
      (defaultPlan) =>
        (planById.get(defaultPlan.id) ??
          defaultPlan) as (typeof PLAN_PRICING)[number],
    );
  }

  /** Platform-staff pricing-page edit — writes straight to the `plans` collection. */
  async updatePlanCatalog(planId: string, dto: UpdatePlanDto) {
    const defaultPlan = PLAN_PRICING.find((plan) => plan.id === planId);
    if (!defaultPlan) {
      throw new NotFoundException("Plan not found");
    }

    const existing = await this.planModel.findOne({ planId }).lean().exec();
    const plan = mergePlan(
      existing?.plan ?? defaultPlan,
      dto as Record<string, unknown>,
    );

    const updated = await this.planModel
      .findOneAndUpdate(
        { planId },
        { $set: { plan } },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();

    return updated?.plan;
  }

  /**
   * Platform-staff triage: a tenant's plan history. Payment docs only exist
   * for actual purchases — a tenant still on the free TRIAL plan has none,
   * so synthesize a TRIAL entry from the Subscription doc (every tenant has
   * one) so the free plan and its period still show up.
   */
  async getPlanHistoryForPlatform(tenantId: string) {
    const [payments, subscription] = await Promise.all([
      this.paymentModel
        .find({ tenantId })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
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

    // Razorpay errors reject with { statusCode, error: { description } } —
    // without this catch, any Razorpay-side rejection (bad plan id, invalid
    // customer, transient API error, ...) bubbles up as an unhandled
    // exception and Nest turns it into an opaque 500. Surface the real
    // reason as a 400 instead.
    let rzpSubId: string;
    let rzpShortUrl: string | null;
    try {
      if (!razorpayCustomerId) {
        const customer = await this.razorpayService.createCustomer({
          name: user.name,
          email: user.email,
          phone: user.phone,
        });
        razorpayCustomerId = String(customer.id);
      }

      const totalCount =
        billingCycle === "yearly"
          ? 10
          : billingCycle === "quarterly"
            ? 40
            : 120;

      // Explicit type annotation breaks ESLint's unsafe-assignment taint from the SDK cast
      const rzpSub: { id: string; short_url?: string } =
        await this.razorpayService.createSubscription({
          planId: pricing.razorpayPlanId,
          customerId: razorpayCustomerId,
          totalCount,
          quantity: 1,
          notes: { tenantId, plan, billingCycle },
        });
      rzpSubId = rzpSub.id;
      rzpShortUrl = rzpSub.short_url ?? null;
    } catch (err) {
      const description = (err as { error?: { description?: string } })?.error
        ?.description;
      this.logger.error(
        `[Billing] Razorpay subscription creation failed for tenant ${tenantId}: ${description ?? String(err)}`,
      );
      throw new BadRequestException(
        description ??
          "Failed to start checkout with Razorpay. Please try again.",
      );
    }

    // Deliberately doesn't set plan/billingCycle/status/razorpaySubId/
    // razorpayPlanId here — this only creates the Razorpay subscription +
    // checkout link, the customer hasn't paid (or even completed the
    // mandate) yet. Writing those onto the tenant's real fields now would
    // both grant paid access before any money moves AND, if the tenant
    // already has an active paid subscription, clobber its razorpaySubId
    // with this abandoned attempt's — breaking webhook matching for the
    // subscription they're actually paying for. Stash them as "pending"
    // instead; the requested plan/billingCycle round-trips through
    // Razorpay's subscription `notes` (see createSubscription call above),
    // and the subscription.activated/charged webhook handlers (matched by
    // pendingRazorpaySubId) promote pending → real only once Razorpay
    // confirms the subscription is genuine.
    await this.subModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          tenantId,
          razorpayCustomerId,
          pendingRazorpaySubId: rzpSubId,
          pendingRazorpayPlanId: pricing.razorpayPlanId,
        },
      },
      { upsert: true, new: true },
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

    // Matched by pendingRazorpaySubId, not razorpaySubId — the latter isn't
    // written until this verification (or the activated/charged webhook)
    // confirms the subscription is real (see createRazorpaySubscription).
    const sub = await this.subModel
      .findOne({
        tenantId,
        pendingRazorpaySubId: data.razorpay_subscription_id,
      })
      .exec();
    if (!sub) throw new NotFoundException("Subscription not found");

    const rzpSub = await this.razorpayService.fetchSubscription(
      data.razorpay_subscription_id,
    );
    const rzpSubData = rzpSub as unknown as {
      current_start?: number;
      current_end?: number;
      notes?: Record<string, string>;
    };

    const periodStart = new Date((rzpSubData.current_start ?? 0) * 1000);
    const periodEnd = new Date((rzpSubData.current_end ?? 0) * 1000);

    // The requested plan/billingCycle only round-trips through Razorpay's
    // subscription notes — createRazorpaySubscription deliberately doesn't
    // write them onto `sub` up front, so `sub.plan` here is still whatever
    // the tenant had before this purchase, not what they're paying for.
    const plan = (rzpSubData.notes?.plan ?? sub.plan) as PlanValue;
    const billingCycle = rzpSubData.notes?.billingCycle ?? sub.billingCycle;

    await this.subModel.updateOne(
      { tenantId },
      {
        $set: {
          status: "ACTIVE",
          plan,
          billingCycle,
          razorpaySubId: data.razorpay_subscription_id,
          razorpayPlanId: sub.pendingRazorpayPlanId,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        },
        $unset: { pendingRazorpaySubId: "", pendingRazorpayPlanId: "" },
      },
    );

    await this.syncUserPlan(tenantId, plan);

    // Save payment record (idempotent)
    const exists = await this.paymentModel
      .findOne({ razorpayPaymentId: data.razorpay_payment_id })
      .lean()
      .exec();

    if (!exists) {
      const pricing = getPlanPricing(
        plan as PlanKey,
        (billingCycle ?? "monthly") as BillingCycle,
      );
      await this.paymentModel.create({
        tenantId,
        razorpayPaymentId: data.razorpay_payment_id,
        razorpaySubscriptionId: data.razorpay_subscription_id,
        amount: pricing?.amount ?? 0,
        currency: "INR",
        status: "success",
        plan,
        billingCycle,
      });
    }

    await this.notificationsService.create(
      tenantId,
      userId,
      "payment_success",
      `${plan} plan activated ✅`,
      `Your ${billingCycle} ${plan} subscription is now active.`,
    );

    this.logger.log(
      `[Billing] Payment verified for tenant ${tenantId}, plan ${plan}`,
    );

    return {
      success: true,
      data: {
        message: "Payment verified — plan activated",
        plan,
        billingCycle,
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
        const subId = sub.id as string;
        // The plan/billingCycle the customer actually requested only lives
        // in the notes we set at creation (createRazorpaySubscription
        // deliberately doesn't touch the tenant's plan pre-payment) — apply
        // it now that Razorpay confirms the mandate is real.
        const notes = sub.notes as Record<string, string> | undefined;

        // First activation is matched by pendingRazorpaySubId (razorpaySubId
        // isn't written until now, precisely so an abandoned checkout can't
        // clobber a tenant's real active subscription); a re-activation
        // after e.g. a pause matches directly on the already-real
        // razorpaySubId.
        const target = await this.subModel
          .findOne({
            $or: [{ razorpaySubId: subId }, { pendingRazorpaySubId: subId }],
          })
          .exec();
        if (!target) break;

        await this.subModel.updateOne(
          { _id: target._id },
          {
            $set: {
              status: "ACTIVE",
              razorpaySubId: subId,
              razorpayPlanId:
                target.pendingRazorpayPlanId ?? target.razorpayPlanId,
              ...(notes?.plan && { plan: notes.plan }),
              ...(notes?.billingCycle && { billingCycle: notes.billingCycle }),
              currentPeriodStart: new Date(
                (sub.current_start as number) * 1000,
              ),
              currentPeriodEnd: new Date((sub.current_end as number) * 1000),
            },
            $unset: { pendingRazorpaySubId: "", pendingRazorpayPlanId: "" },
          },
        );
        const activatedSub = await this.subModel
          .findOne({ razorpaySubId: subId })
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

        // Same as subscription.activated — cover the case where "charged"
        // is the first webhook we see for a brand-new subscription (plan
        // not applied yet since createRazorpaySubscription doesn't set it),
        // matching via pendingRazorpaySubId and promoting pending → real.
        const chargedNotes = sub.notes as Record<string, string> | undefined;
        const chargedSubId = sub.id as string;
        const chargedTarget = await this.subModel
          .findOne({
            $or: [
              { razorpaySubId: chargedSubId },
              { pendingRazorpaySubId: chargedSubId },
            ],
          })
          .exec();
        if (chargedTarget) {
          await this.subModel.updateOne(
            { _id: chargedTarget._id },
            {
              $set: {
                status: "ACTIVE",
                razorpaySubId: chargedSubId,
                razorpayPlanId:
                  chargedTarget.pendingRazorpayPlanId ??
                  chargedTarget.razorpayPlanId,
                ...(chargedNotes?.plan && { plan: chargedNotes.plan }),
                ...(chargedNotes?.billingCycle && {
                  billingCycle: chargedNotes.billingCycle,
                }),
                currentPeriodEnd: new Date((sub.current_end as number) * 1000),
              },
              $unset: { pendingRazorpaySubId: "", pendingRazorpayPlanId: "" },
            },
          );
        }

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
