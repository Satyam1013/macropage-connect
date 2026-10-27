import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import { ClientSession, Connection, Model, Types } from "mongoose";
import { User, UserDocument } from "../../users/schemas/user.schema";
import {
  Subscription,
  SubscriptionDocument,
} from "../../schemas/subscription.schema";
import {
  SubscriptionHistory,
  SubscriptionHistoryDocument,
} from "../../schemas/subscription-history.schema";
import {
  AdminAuditLog,
  AdminAuditLogDocument,
} from "../../schemas/admin-audit-log.schema";
import {
  WebhookEndpoint,
  WebhookEndpointDocument,
} from "../../schemas/webhook-endpoint.schema";
import { APIKey, APIKeyDocument } from "../../schemas/api-key.schema";
import { Session, SessionDocument } from "../../schemas/session.schema";
import {
  RefreshToken,
  RefreshTokenDocument,
} from "../../schemas/refresh-token.schema";
import {
  TeamInvite,
  TeamInviteDocument,
} from "../../schemas/team-invite.schema";
import { UserRole } from "../../auth/auth.constants";
import { BillingService } from "../../billing/billing.service";
import { RazorpayService } from "../../billing/razorpay.service";
import { PLANS } from "../../billing/plans.config";
import { CampaignsService } from "../../campaigns/campaigns.service";
import { SocketService } from "../../gateway/socket.service";
import { EmailService } from "../../queue/email.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AccountStatusService } from "../../account-status/account-status.service";
import {
  ADMIN_PLAN_IDS,
  AdminBillingCycle,
  AdminPlanId,
  CreateSubscriptionDto,
} from "./dto/create-subscription.dto";
import { ExtendSubscriptionDto } from "./dto/extend-subscription.dto";
import { SuspendCustomerDto } from "./dto/suspend-customer.dto";
import { DeleteCustomerDto } from "./dto/delete-customer.dto";

const CYCLE_MONTHS: Record<AdminBillingCycle, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

const PLAN_NAMES: Record<AdminPlanId, string> = {
  STARTER: PLANS.STARTER.name,
  GROWTH: PLANS.GROWTH.name,
  BUSINESS: PLANS.BUSINESS.name,
  ENTERPRISE: "Enterprise",
};

// Statuses under which Razorpay may still charge the customer.
const RAZORPAY_LIVE_STATUSES = ["ACTIVE", "PAST_DUE"];

type CatalogPlan = {
  id: AdminPlanId;
  name: string;
  pricing?: Partial<Record<AdminBillingCycle, { price?: number }>>;
};

/**
 * The plan's list price for a whole cycle, in INR. Catalog prices are per
 * month (quarterly/yearly are discounted monthly rates), so multiply by the
 * cycle length — e.g. Starter yearly ₹1,499 × 12 = ₹17,988, as billed.
 * Custom-priced plans (Enterprise) come out as 0.
 */
export function listPrice(plan: CatalogPlan, cycle: AdminBillingCycle): number {
  const monthly = plan.pricing?.[cycle]?.price ?? 0;
  return monthly * CYCLE_MONTHS[cycle];
}

/** Adds months, clamping the day (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function addPeriod(date: Date, months: number, days: number): Date {
  const d = addMonths(date, months);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function apiError(
  Exception:
    | typeof BadRequestException
    | typeof NotFoundException
    | typeof ConflictException
    | typeof ForbiddenException
    | typeof BadGatewayException,
  code: string,
  message: string,
) {
  return new Exception({ success: false, code, message });
}

type SubLike = Pick<
  Subscription,
  "plan" | "status" | "currentPeriodEnd" | "billingCycle"
>;

function hasRunOut(sub: SubLike, now = new Date()): boolean {
  return (
    !["ACTIVE", "PAST_DUE"].includes(sub.status) ||
    !sub.currentPeriodEnd ||
    new Date(sub.currentPeriodEnd).getTime() <= now.getTime()
  );
}

/**
 * Platform-staff account management for a customer (an OWNER user):
 * manual subscriptions, extensions, suspension and soft deletion. A
 * customer's billing lives on their own main account (tenantId = their
 * _id — see TenantResolverService.resolveBillingTenantId); suspension and
 * deletion cover every project they own.
 */
@Injectable()
export class AccountManagementService {
  private readonly logger = new Logger(AccountManagementService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionHistory.name)
    private readonly historyModel: Model<SubscriptionHistoryDocument>,
    @InjectModel(AdminAuditLog.name)
    private readonly auditModel: Model<AdminAuditLogDocument>,
    @InjectModel(WebhookEndpoint.name)
    private readonly webhookModel: Model<WebhookEndpointDocument>,
    @InjectModel(APIKey.name)
    private readonly apiKeyModel: Model<APIKeyDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(TeamInvite.name)
    private readonly inviteModel: Model<TeamInviteDocument>,
    private readonly billingService: BillingService,
    private readonly razorpayService: RazorpayService,
    private readonly campaignsService: CampaignsService,
    private readonly socketService: SocketService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly accountStatus: AccountStatusService,
  ) {}

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async createSubscription(
    adminId: string,
    customerId: string,
    dto: CreateSubscriptionDto,
  ) {
    const customer = await this.findCustomer(customerId);
    if (customer.accountStatus === "deleted") {
      throw apiError(
        ConflictException,
        "ACCOUNT_DELETED",
        "This account has been deleted.",
      );
    }

    const plan = await this.resolvePlan(dto.planId);
    const planId = plan.id;
    const amountPaid =
      dto.amountPaid ??
      (dto.paymentMode === "complimentary"
        ? 0
        : listPrice(plan, dto.billingCycle));
    const historyType =
      dto.paymentMode === "complimentary" || amountPaid === 0
        ? "admin_grant"
        : "purchase";
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const expiresAt = addMonths(startDate, CYCLE_MONTHS[dto.billingCycle]);

    const tenantId = customerId;
    const before = await this.subModel.findOne({ tenantId }).lean().exec();

    // Razorpay would keep charging (and its webhooks would overwrite this
    // plan) — cancel auto-pay first, and stop here if that fails so the
    // customer is never on two subscriptions.
    if (before && this.hasLiveRazorpay(before)) {
      await this.cancelRazorpay(before.razorpaySubId ?? "", tenantId);
    }

    await this.inTransaction(async (session) => {
      if (before && before.plan !== "TRIAL" && !hasRunOut(before)) {
        await this.historyModel.create(
          [
            {
              tenantId,
              type: "replaced",
              plan: before.plan,
              planName: PLAN_NAMES[before.plan] ?? before.plan,
              billingCycle: before.billingCycle,
              amount: 0,
              status: "replaced",
              periodStart: before.currentPeriodStart,
              periodEnd: before.currentPeriodEnd,
              createdBy: adminId,
              date: new Date(),
              note: `Replaced by ${planId} (${dto.billingCycle})`,
            },
          ],
          { session },
        );
      }

      // Same end state as a confirmed Razorpay purchase (verifyPayment):
      // plan + period on the subscription, trial and pending checkout
      // cleared, then the plan synced onto the users.
      await this.subModel.updateOne(
        { tenantId },
        {
          $set: {
            tenantId,
            plan: planId,
            billingCycle: dto.billingCycle,
            status: "ACTIVE",
            source: "ADMIN",
            currentPeriodStart: startDate,
            currentPeriodEnd: expiresAt,
            cancelAtPeriodEnd: false,
          },
          $unset: {
            trialEndsAt: "",
            razorpaySubId: "",
            razorpayPlanId: "",
            pendingRazorpaySubId: "",
            pendingRazorpayPlanId: "",
            cancelledAt: "",
            paymentFailedAt: "",
          },
        },
        { upsert: true, session },
      );
      await this.billingService.syncUserPlan(tenantId, planId, session);

      await this.historyModel.create(
        [
          {
            tenantId,
            type: historyType,
            plan: planId,
            planName: plan.name,
            billingCycle: dto.billingCycle,
            amount: amountPaid,
            date: startDate,
            status: "active",
            paymentMode: dto.paymentMode ?? "manual",
            periodStart: startDate,
            periodEnd: expiresAt,
            createdBy: adminId,
            note: dto.note,
          },
        ],
        { session },
      );

      await this.audit(
        {
          adminId,
          customerId,
          action: "SUBSCRIPTION_CREATE",
          reason: dto.note,
          before: this.subSnapshot(before),
          after: {
            plan: planId,
            billingCycle: dto.billingCycle,
            status: "ACTIVE",
            currentPeriodStart: startDate,
            currentPeriodEnd: expiresAt,
          },
          meta: {
            amountPaid,
            historyType,
            paymentMode: dto.paymentMode ?? "manual",
            cancelledRazorpaySubId:
              before && this.hasLiveRazorpay(before)
                ? before.razorpaySubId
                : undefined,
          },
        },
        session,
      );
    });

    this.notifyInApp(
      customerId,
      `${plan.name} plan activated`,
      `Your ${dto.billingCycle} ${plan.name} plan is active until ${expiresAt.toDateString()}.`,
    );

    return {
      planId,
      billingCycle: dto.billingCycle,
      startDate,
      expiresAt,
      status: "active",
    };
  }

  async extendSubscription(
    adminId: string,
    customerId: string,
    dto: ExtendSubscriptionDto,
  ) {
    const months = dto.months ?? 0;
    const days = dto.days ?? 0;
    if (months <= 0 && days <= 0) {
      throw apiError(
        BadRequestException,
        "VALIDATION_ERROR",
        "Provide months or days greater than 0.",
      );
    }

    const customer = await this.findCustomer(customerId);
    if (customer.accountStatus === "deleted") {
      throw apiError(
        ConflictException,
        "ACCOUNT_DELETED",
        "This account has been deleted.",
      );
    }

    const tenantId = customerId;
    const sub = await this.subModel.findOne({ tenantId }).lean().exec();
    // A free trial was never purchased — there's nothing to extend.
    if (!sub || sub.plan === "TRIAL") {
      throw apiError(
        BadRequestException,
        "NO_SUBSCRIPTION",
        "This customer has no subscription to extend. Create a subscription first.",
      );
    }

    const now = new Date();
    const expired = hasRunOut(sub, now);
    const base = expired ? now : new Date(sub.currentPeriodEnd!);
    const expiresAt = addPeriod(base, months, days);

    await this.inTransaction(async (session) => {
      await this.subModel.updateOne(
        { tenantId },
        expired
          ? {
              $set: {
                currentPeriodEnd: expiresAt,
                status: "ACTIVE",
                // No auto-pay renews a reactivated period.
                source: "ADMIN",
                cancelAtPeriodEnd: false,
              },
              $unset: { cancelledAt: "" },
            }
          : { $set: { currentPeriodEnd: expiresAt } },
        { session },
      );
      // Reactivation restores the plan's entitlements, as on purchase.
      if (expired) {
        await this.billingService.syncUserPlan(tenantId, sub.plan, session);
      }

      await this.historyModel.create(
        [
          {
            tenantId,
            type: "extension",
            plan: sub.plan,
            planName: PLAN_NAMES[sub.plan as AdminPlanId] ?? sub.plan,
            billingCycle: sub.billingCycle,
            amount: 0,
            status: "active",
            periodStart: expired ? now : sub.currentPeriodStart,
            periodEnd: expiresAt,
            previousPeriodEnd: sub.currentPeriodEnd,
            extension: { months, days },
            date: now,
            createdBy: adminId,
            reason: dto.reason,
            note: dto.reason,
          },
        ],
        { session },
      );

      await this.audit(
        {
          adminId,
          customerId,
          action: "SUBSCRIPTION_EXTEND",
          reason: dto.reason,
          before: this.subSnapshot(sub),
          after: {
            ...this.subSnapshot(sub),
            status: "ACTIVE",
            currentPeriodEnd: expiresAt,
          },
          meta: { months, days, reactivated: expired },
        },
        session,
      );
    });

    this.notifyInApp(
      customerId,
      "Subscription extended",
      `Your ${PLAN_NAMES[sub.plan] ?? sub.plan} plan now runs until ${expiresAt.toDateString()}.`,
    );

    return { planId: sub.plan, expiresAt, status: "active" };
  }

  // ── Suspension ────────────────────────────────────────────────────────────

  async suspend(adminId: string, customerId: string, dto: SuspendCustomerDto) {
    const customer = await this.findCustomer(customerId);
    if (customer.accountStatus === "deleted") {
      throw apiError(
        ConflictException,
        "ACCOUNT_DELETED",
        "This account has been deleted.",
      );
    }

    // Conditional update makes concurrent/repeated calls a no-op.
    const res = await this.userModel.updateOne(
      { _id: customer._id, accountStatus: { $nin: ["suspended", "deleted"] } },
      {
        $set: {
          accountStatus: "suspended",
          suspendedAt: new Date(),
          suspendedBy: adminId,
          suspensionReason: dto.reason,
        },
      },
    );
    if (res.modifiedCount === 0) {
      return {
        success: true,
        accountStatus: "suspended",
        alreadySuspended: true,
      };
    }

    // Access tokens are already refused by the status check on every
    // request; also drop sessions/refresh tokens so nothing can be renewed.
    const [stopped, sessions, refreshTokens] = await Promise.all([
      this.stopOutboundActivity(customerId),
      this.sessionModel.deleteMany({ userId: customerId }),
      this.refreshTokenModel.deleteMany({ userId: customerId }),
    ]);
    await this.audit({
      adminId,
      customerId,
      action: "SUSPEND",
      reason: dto.reason,
      before: { accountStatus: customer.accountStatus ?? "active" },
      after: { accountStatus: "suspended" },
      meta: {
        ...stopped,
        sessionsRevoked: sessions.deletedCount,
        refreshTokensRevoked: refreshTokens.deletedCount,
      },
    });

    this.notifyByEmail(
      customer.email,
      "Your Macropage Connect account has been suspended",
      `Your account has been suspended. Reason: ${dto.reason}. Your data is retained. Please contact Macropage support to restore access.`,
    );

    return { success: true, accountStatus: "suspended" };
  }

  async unsuspend(adminId: string, customerId: string) {
    const customer = await this.findCustomer(customerId);

    const res = await this.userModel.updateOne(
      { _id: customer._id, accountStatus: "suspended" },
      {
        $set: { accountStatus: "active" },
        $unset: { suspendedAt: "", suspendedBy: "", suspensionReason: "" },
      },
    );
    if (res.modifiedCount === 0) {
      if (customer.accountStatus === "deleted") {
        throw apiError(
          ConflictException,
          "ACCOUNT_DELETED",
          "A deleted account can't be restored.",
        );
      }
      return { success: true, accountStatus: "active", alreadyActive: true };
    }

    // Only what the suspension paused; the subscription is left as-is, so
    // one that expired meanwhile stays expired.
    const tenantIds = await this.accountStatus.ownedTenantIds(customerId);
    const [campaignsResumed, webhooks] = await Promise.all([
      this.campaignsService.resumeAfterSuspension(tenantIds),
      this.webhookModel.updateMany(
        { tenantId: { $in: tenantIds }, disabledBySuspension: true },
        { $set: { isEnabled: true, disabledBySuspension: false } },
      ),
    ]);

    await this.audit({
      adminId,
      customerId,
      action: "UNSUSPEND",
      reason: customer.suspensionReason,
      before: {
        accountStatus: "suspended",
        suspendedAt: customer.suspendedAt,
        suspendedBy: customer.suspendedBy,
      },
      after: { accountStatus: "active" },
      meta: { campaignsResumed, webhooksReenabled: webhooks.modifiedCount },
    });

    return { success: true, accountStatus: "active" };
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async softDelete(
    adminId: string,
    customerId: string,
    dto: DeleteCustomerDto,
  ) {
    const customer = await this.findCustomer(customerId);
    const realEmail = (customer.deletedEmail ?? customer.email).toLowerCase();
    if (dto.confirmEmail.trim().toLowerCase() !== realEmail) {
      throw apiError(
        BadRequestException,
        "CONFIRM_EMAIL_MISMATCH",
        "confirmEmail doesn't match the customer's email.",
      );
    }
    if (customer.accountStatus === "deleted") return { success: true };

    // Stop auto-pay before anything else; abort if Razorpay refuses, so a
    // deleted customer is never left being charged.
    const sub = await this.subModel
      .findOne({ tenantId: customerId })
      .lean()
      .exec();
    let cancelledRazorpaySubId: string | undefined;
    if (sub && this.hasLiveRazorpay(sub)) {
      await this.cancelRazorpay(sub.razorpaySubId ?? "", customerId);
      cancelledRazorpaySubId = sub.razorpaySubId;
    }
    if (sub?.pendingRazorpaySubId) {
      // An unfinished checkout — best effort, nothing has been charged.
      this.razorpayService
        .cancelSubscription(sub.pendingRazorpaySubId, false)
        .catch(() => undefined);
    }

    // Free the email (unique index) and phone for a new registration.
    const res = await this.userModel.updateOne(
      { _id: customer._id, accountStatus: { $ne: "deleted" } },
      {
        $set: {
          accountStatus: "deleted",
          deletedAt: new Date(),
          deletedBy: adminId,
          deleteReason: dto.reason,
          deletedEmail: customer.email,
          email: `deleted:${customerId}:${customer.email}`,
          ...(customer.phone && { deletedPhone: customer.phone }),
        },
        $unset: { phone: "" },
      },
    );
    if (res.modifiedCount === 0) return { success: true };

    if (sub) {
      // Cancelled, but expiry dates and history stay for audit.
      await this.subModel.updateOne(
        { tenantId: customerId },
        {
          $set: {
            status: "CANCELLED",
            cancelAtPeriodEnd: false,
            cancelledAt: new Date(),
          },
          $unset: { pendingRazorpaySubId: "", pendingRazorpayPlanId: "" },
        },
      );
    }

    const tenantIds = await this.accountStatus.ownedTenantIds(customerId);
    const [stopped, sessions, refreshTokens, apiKeys, invites] =
      await Promise.all([
        this.stopOutboundActivity(customerId, tenantIds),
        this.sessionModel.deleteMany({ userId: customerId }),
        this.refreshTokenModel.deleteMany({ userId: customerId }),
        this.apiKeyModel.updateMany(
          { tenantId: { $in: tenantIds }, isActive: true },
          { $set: { isActive: false } },
        ),
        this.inviteModel.updateMany(
          { tenantId: { $in: tenantIds }, status: "PENDING" },
          { $set: { status: "CANCELLED" } },
        ),
      ]);

    await this.audit({
      adminId,
      customerId,
      action: "DELETE",
      reason: dto.reason,
      before: {
        accountStatus: customer.accountStatus ?? "active",
        email: customer.email,
        phone: customer.phone,
      },
      after: {
        accountStatus: "deleted",
        email: `deleted:${customerId}:${customer.email}`,
      },
      meta: {
        ...stopped,
        cancelledRazorpaySubId,
        sessionsRevoked: sessions.deletedCount,
        refreshTokensRevoked: refreshTokens.deletedCount,
        apiKeysRevoked: apiKeys.modifiedCount,
        invitesCancelled: invites.modifiedCount,
      },
    });

    this.notifyByEmail(
      customer.email,
      "Your Macropage Connect account has been deleted",
      `Your account has been closed. Reason: ${dto.reason}. Contact Macropage support if you believe this is a mistake.`,
    );

    return { success: true };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async findCustomer(customerId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw apiError(
        NotFoundException,
        "CUSTOMER_NOT_FOUND",
        "Customer not found",
      );
    }
    const customer = await this.userModel
      .findOne({ _id: customerId, role: UserRole.OWNER })
      .exec();
    if (!customer) {
      throw apiError(
        NotFoundException,
        "CUSTOMER_NOT_FOUND",
        "Customer not found",
      );
    }
    // Staff accounts are OWNER users too (see migrate-admin-users) — never
    // let this API lock out or bill a staff member.
    if (customer.platformRole) {
      throw apiError(
        ForbiddenException,
        "PLATFORM_STAFF_ACCOUNT",
        "Platform staff accounts can't be managed through this API.",
      );
    }
    return customer;
  }

  /**
   * The plan from the same catalog GET /billing/plans serves, matched
   * case-insensitively. 404 when it doesn't exist (TRIAL isn't grantable).
   */
  private async resolvePlan(planId: string): Promise<CatalogPlan> {
    const wanted = planId.trim().toUpperCase();
    const plans =
      (await this.billingService.getPlans()) as unknown as CatalogPlan[];
    const plan = plans.find((p) => String(p.id).toUpperCase() === wanted);
    if (!plan || !(ADMIN_PLAN_IDS as readonly string[]).includes(plan.id)) {
      throw apiError(
        NotFoundException,
        "PLAN_NOT_FOUND",
        `Plan "${planId}" doesn't exist. Valid plans: ${ADMIN_PLAN_IDS.join(", ")}.`,
      );
    }
    return { ...plan, id: plan.id };
  }

  private hasLiveRazorpay(sub: Pick<Subscription, "razorpaySubId" | "status">) {
    return (
      Boolean(sub.razorpaySubId) && RAZORPAY_LIVE_STATUSES.includes(sub.status)
    );
  }

  private async cancelRazorpay(subId: string, tenantId: string): Promise<void> {
    try {
      await this.razorpayService.cancelSubscription(subId, false);
    } catch (err) {
      const description = (err as { error?: { description?: string } })?.error
        ?.description;
      this.logger.error(
        `[AccountMgmt] Razorpay cancel failed for ${subId} (tenant ${tenantId}): ${description ?? String(err)}`,
      );
      throw apiError(
        BadGatewayException,
        "RAZORPAY_CANCEL_FAILED",
        `Couldn't cancel the customer's Razorpay auto-pay (${description ?? "unknown error"}). Nothing was changed — try again.`,
      );
    }
  }

  /**
   * Pause campaigns, disable outgoing webhooks and drop live sockets for
   * every project the customer owns. Sends that slip through are refused
   * anyway: MetaService.getClient() checks the account status.
   */
  private async stopOutboundActivity(customerId: string, tenantIds?: string[]) {
    const ids =
      tenantIds ?? (await this.accountStatus.ownedTenantIds(customerId));
    const [campaignsPaused, webhooks] = await Promise.all([
      this.campaignsService.pauseForSuspension(ids),
      this.webhookModel.updateMany(
        { tenantId: { $in: ids }, isEnabled: true },
        { $set: { isEnabled: false, disabledBySuspension: true } },
      ),
    ]);

    const server = this.socketService.getServer();
    if (server) {
      server
        .in([`user:${customerId}`, ...ids.map((id) => `tenant:${id}`)])
        .disconnectSockets(true);
    }

    return { campaignsPaused, webhooksDisabled: webhooks.modifiedCount };
  }

  private async inTransaction(
    work: (session: ClientSession) => Promise<void>,
  ): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  private async audit(
    entry: {
      adminId: string;
      customerId: string;
      action: string;
      reason?: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      meta?: Record<string, unknown>;
    },
    session?: ClientSession,
  ): Promise<void> {
    await this.auditModel.create([entry], session ? { session } : {});
  }

  private subSnapshot(sub: (SubLike & Partial<Subscription>) | null) {
    if (!sub) return { subscription: null };
    return {
      plan: sub.plan,
      billingCycle: sub.billingCycle,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      source: sub.source,
      razorpaySubId: sub.razorpaySubId,
    };
  }

  private notifyInApp(customerId: string, title: string, body: string) {
    this.notificationsService
      .create(customerId, customerId, "plan_changed", title, body)
      .catch((err: unknown) =>
        this.logger.error(`[AccountMgmt] notify ${customerId} failed`, err),
      );
  }

  // Suspended/deleted customers can't log in to see an in-app notice.
  private notifyByEmail(to: string, subject: string, body: string) {
    this.emailService
      .sendNotificationEmail(to, subject, body)
      .catch((err: unknown) =>
        this.logger.error(`[AccountMgmt] email to ${to} failed`, err),
      );
  }
}
