// jest's mock.calls are typed any[] — asserting on recorded arguments
// needs member access on them.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  HttpException,
} from "@nestjs/common";
import { Types } from "mongoose";
import {
  AccountManagementService,
  addMonths,
  addPeriod,
} from "./account-management.service";

// Mongoose query stand-in: every chain method returns itself, exec()
// resolves the given result.
function query<T>(result: T) {
  const q = {
    select: () => q,
    lean: () => q,
    sort: () => q,
    session: () => q,
    exec: () => Promise.resolve(result),
  };
  return q;
}

const DAY = 24 * 60 * 60 * 1000;
const CUSTOMER_ID = new Types.ObjectId().toString();
const ADMIN_ID = "admin-1";

function errorCode(err: unknown): string | undefined {
  return ((err as HttpException).getResponse() as { code?: string }).code;
}

function setup(opts: {
  customer?: Record<string, unknown> | null;
  sub?: Record<string, unknown> | null;
  userUpdateModified?: number;
}) {
  const customer =
    opts.customer === undefined
      ? {
          _id: CUSTOMER_ID,
          id: CUSTOMER_ID,
          email: "Owner@Example.com",
          phone: "+919999999999",
          role: "OWNER",
          accountStatus: "active",
        }
      : opts.customer;

  const session = { id: "txn" };
  const connection = {
    startSession: jest.fn().mockResolvedValue({
      withTransaction: (fn: () => Promise<void>) => fn(),
      endSession: jest.fn().mockResolvedValue(undefined),
      ...session,
    }),
  };
  const userModel = {
    findOne: jest.fn(() => query(customer)),
    updateOne: jest
      .fn()
      .mockResolvedValue({ modifiedCount: opts.userUpdateModified ?? 1 }),
  };
  const subModel = {
    findOne: jest.fn(() => query(opts.sub ?? null)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const historyModel = { create: jest.fn().mockResolvedValue([]) };
  const auditModel = { create: jest.fn().mockResolvedValue([]) };
  const webhookModel = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  };
  const apiKeyModel = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
  };
  const sessionModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const refreshTokenModel = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };
  const inviteModel = {
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  };
  // Same shape as GET /billing/plans (per-month prices, INR).
  const billingService = {
    syncUserPlan: jest.fn().mockResolvedValue(undefined),
    getPlans: jest.fn().mockResolvedValue([
      {
        id: "STARTER",
        name: "Starter",
        pricing: {
          monthly: { price: 1999 },
          quarterly: { price: 1799 },
          yearly: { price: 1499 },
        },
      },
      { id: "GROWTH", name: "Growth", pricing: { monthly: { price: 3499 } } },
      {
        id: "ENTERPRISE",
        name: "Enterprise",
        pricing: { yearly: { price: 0 } },
      },
    ]),
  };
  const razorpayService = {
    cancelSubscription: jest.fn().mockResolvedValue({}),
  };
  const campaignsService = {
    pauseForSuspension: jest.fn().mockResolvedValue(1),
    resumeAfterSuspension: jest.fn().mockResolvedValue(1),
  };
  const disconnectSockets = jest.fn();
  const socketService = {
    getServer: () => ({ in: () => ({ disconnectSockets }) }),
  };
  const emailService = {
    sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const accountStatus = {
    ownedTenantIds: jest.fn().mockResolvedValue([CUSTOMER_ID]),
  };

  const service = new AccountManagementService(
    connection as never,
    userModel as never,
    subModel as never,
    historyModel as never,
    auditModel as never,
    webhookModel as never,
    apiKeyModel as never,
    sessionModel as never,
    refreshTokenModel as never,
    inviteModel as never,
    billingService as never,
    razorpayService as never,
    campaignsService as never,
    socketService as never,
    emailService as never,
    notificationsService as never,
    accountStatus as never,
  );

  return {
    service,
    userModel,
    subModel,
    historyModel,
    auditModel,
    billingService,
    razorpayService,
    campaignsService,
    emailService,
    disconnectSockets,
    apiKeyModel,
    sessionModel,
    refreshTokenModel,
  };
}

describe("date helpers", () => {
  it("clamps the day when the target month is shorter", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("adds 3 and 12 months for quarterly/yearly", () => {
    const start = new Date("2026-10-13T10:00:00Z");
    expect(addMonths(start, 3).toISOString()).toBe("2027-01-13T10:00:00.000Z");
    expect(addMonths(start, 12).toISOString()).toBe("2027-10-13T10:00:00.000Z");
  });

  it("adds months and days together", () => {
    expect(
      addPeriod(new Date("2026-10-13T00:00:00Z"), 1, 5).toISOString(),
    ).toBe("2026-11-18T00:00:00.000Z");
  });
});

describe("AccountManagementService.createSubscription", () => {
  it("replaces an active Razorpay subscription: cancels auto-pay, records the replaced plan, activates the new one", async () => {
    const t = setup({
      sub: {
        plan: "GROWTH",
        status: "ACTIVE",
        billingCycle: "monthly",
        currentPeriodStart: new Date(Date.now() - 10 * DAY),
        currentPeriodEnd: new Date(Date.now() + 20 * DAY),
        razorpaySubId: "sub_live",
      },
    });

    // The admin panel may send any case; the DTO uppercases, the service
    // matches case-insensitively either way.
    const res = await t.service.createSubscription(ADMIN_ID, CUSTOMER_ID, {
      planId: "starter",
      billingCycle: "quarterly",
      startDate: "2026-10-13",
      note: "deal",
    });

    expect(res).toEqual({
      planId: "STARTER",
      billingCycle: "quarterly",
      startDate: new Date("2026-10-13"),
      expiresAt: new Date("2027-01-13"),
      status: "active",
    });
    expect(t.razorpayService.cancelSubscription).toHaveBeenCalledWith(
      "sub_live",
      false,
    );

    const types = t.historyModel.create.mock.calls.map(
      ([docs]: [Array<{ type: string }>]) => docs[0].type,
    );
    expect(types).toEqual(["replaced", "purchase"]);
    const created = t.historyModel.create.mock.calls[1][0][0];
    expect(created).toMatchObject({
      plan: "STARTER",
      planName: "Starter",
      status: "active",
      createdBy: ADMIN_ID,
      note: "deal",
      amount: 5397, // ₹1,799/month × 3 — the catalog's quarterly price
      date: new Date("2026-10-13"),
    });

    const [, update] = t.subModel.updateOne.mock.calls[0];
    expect(update.$set).toMatchObject({
      plan: "STARTER",
      status: "ACTIVE",
      source: "ADMIN",
    });
    expect(update.$unset).toHaveProperty("trialEndsAt");
    expect(update.$unset).toHaveProperty("razorpaySubId");
    expect(t.billingService.syncUserPlan).toHaveBeenCalledWith(
      CUSTOMER_ID,
      "STARTER",
      expect.anything(),
    );
    expect(t.auditModel.create).toHaveBeenCalled();
  });

  it("aborts without changes when Razorpay refuses to cancel auto-pay", async () => {
    const t = setup({
      sub: {
        plan: "GROWTH",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + DAY),
        razorpaySubId: "sub_live",
      },
    });
    t.razorpayService.cancelSubscription.mockRejectedValue({
      error: { description: "boom" },
    });

    await expect(
      t.service.createSubscription(ADMIN_ID, CUSTOMER_ID, {
        planId: "GROWTH",
        billingCycle: "monthly",
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(t.subModel.updateOne).not.toHaveBeenCalled();
    expect(t.historyModel.create).not.toHaveBeenCalled();
  });

  it("records amountPaid as-is (INR); a custom-priced plan without one is a 0 admin_grant", async () => {
    const paid = setup({ sub: null });
    await paid.service.createSubscription(ADMIN_ID, CUSTOMER_ID, {
      planId: "ENTERPRISE",
      billingCycle: "yearly",
      amountPaid: 50000,
    });
    expect(paid.historyModel.create.mock.calls[0][0][0]).toMatchObject({
      type: "purchase",
      amount: 50000,
    });

    const free = setup({ sub: null });
    await free.service.createSubscription(ADMIN_ID, CUSTOMER_ID, {
      planId: "ENTERPRISE",
      billingCycle: "yearly",
    });
    expect(free.historyModel.create.mock.calls[0][0][0]).toMatchObject({
      type: "admin_grant",
      amount: 0,
    });
  });

  it("is an admin_grant with amount 0 when complimentary", async () => {
    const t = setup({ sub: null });
    await t.service.createSubscription(ADMIN_ID, CUSTOMER_ID, {
      planId: "GROWTH",
      billingCycle: "monthly",
      paymentMode: "complimentary",
    });
    expect(t.historyModel.create.mock.calls[0][0][0]).toMatchObject({
      type: "admin_grant",
      amount: 0,
      planName: "Growth",
    });
  });

  it("returns 404 for a plan that isn't in the catalog (or the trial)", async () => {
    for (const planId of ["GOLD", "TRIAL"]) {
      const t = setup({ sub: null });
      const err = await t.service
        .createSubscription(ADMIN_ID, CUSTOMER_ID, {
          planId,
          billingCycle: "monthly",
        })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect(errorCode(err)).toBe("PLAN_NOT_FOUND");
      expect(t.subModel.updateOne).not.toHaveBeenCalled();
    }
  });
});

describe("AccountManagementService.extendSubscription", () => {
  it("extends an active subscription from its current expiry", async () => {
    const end = new Date(Date.now() + 10 * DAY);
    const t = setup({
      sub: { plan: "GROWTH", status: "ACTIVE", currentPeriodEnd: end },
    });

    const res = await t.service.extendSubscription(ADMIN_ID, CUSTOMER_ID, {
      months: 1,
      days: 2,
      reason: "goodwill",
    });

    expect(res.expiresAt).toEqual(addPeriod(end, 1, 2));
    expect(res.status).toBe("active");
    expect(t.billingService.syncUserPlan).not.toHaveBeenCalled();
    const [, update] = t.subModel.updateOne.mock.calls[0];
    expect(update).toEqual({ $set: { currentPeriodEnd: res.expiresAt } });
    expect(t.historyModel.create.mock.calls[0][0][0]).toMatchObject({
      type: "extension",
      reason: "goodwill",
      amount: 0,
      extension: { months: 1, days: 2 },
      note: "goodwill",
      createdBy: ADMIN_ID,
    });
  });

  it("reactivates an expired subscription from now and restores entitlements", async () => {
    const t = setup({
      sub: {
        plan: "BUSINESS",
        status: "EXPIRED",
        currentPeriodEnd: new Date(Date.now() - 5 * DAY),
      },
    });
    const before = Date.now();

    const res = await t.service.extendSubscription(ADMIN_ID, CUSTOMER_ID, {
      days: 10,
    });

    const expected = before + 10 * DAY;
    expect(Math.abs(res.expiresAt.getTime() - expected)).toBeLessThan(5000);
    const [, update] = t.subModel.updateOne.mock.calls[0];
    expect(update.$set).toMatchObject({ status: "ACTIVE", source: "ADMIN" });
    expect(t.billingService.syncUserPlan).toHaveBeenCalledWith(
      CUSTOMER_ID,
      "BUSINESS",
      expect.anything(),
    );
  });

  it("treats an ACTIVE subscription whose period has passed as expired", async () => {
    const t = setup({
      sub: {
        plan: "GROWTH",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() - DAY),
      },
    });
    await t.service.extendSubscription(ADMIN_ID, CUSTOMER_ID, { months: 1 });
    expect(t.billingService.syncUserPlan).toHaveBeenCalled();
  });

  it.each([
    ["no subscription", null],
    ["only a free trial", { plan: "TRIAL", status: "TRIALING" }],
  ])("returns 400 when the customer has %s", async (_label, sub) => {
    const t = setup({ sub });
    const err = await t.service
      .extendSubscription(ADMIN_ID, CUSTOMER_ID, { months: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(errorCode(err)).toBe("NO_SUBSCRIPTION");
    expect(t.subModel.updateOne).not.toHaveBeenCalled();
  });

  it("returns 400 when neither months nor days is > 0", async () => {
    const t = setup({ sub: { plan: "GROWTH", status: "ACTIVE" } });
    await expect(
      t.service.extendSubscription(ADMIN_ID, CUSTOMER_ID, {
        months: 0,
        days: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("AccountManagementService suspend/unsuspend", () => {
  it("suspends once: pauses activity, drops sockets, audits and emails", async () => {
    const t = setup({});
    const res = await t.service.suspend(ADMIN_ID, CUSTOMER_ID, {
      reason: "abuse",
    });

    expect(res).toEqual({ success: true, accountStatus: "suspended" });
    const [filter, update] = t.userModel.updateOne.mock.calls[0];
    expect(filter.accountStatus).toEqual({ $nin: ["suspended", "deleted"] });
    expect(update.$set).toMatchObject({
      accountStatus: "suspended",
      suspendedBy: ADMIN_ID,
      suspensionReason: "abuse",
    });
    expect(t.campaignsService.pauseForSuspension).toHaveBeenCalledWith([
      CUSTOMER_ID,
    ]);
    expect(t.disconnectSockets).toHaveBeenCalledWith(true);
    // Sessions/refresh tokens are dropped so nothing can be renewed.
    expect(t.sessionModel.deleteMany).toHaveBeenCalledWith({
      userId: CUSTOMER_ID,
    });
    expect(t.refreshTokenModel.deleteMany).toHaveBeenCalledWith({
      userId: CUSTOMER_ID,
    });
    expect(t.auditModel.create).toHaveBeenCalled();
    expect(t.emailService.sendNotificationEmail).toHaveBeenCalled();
    // Expiry dates are untouched.
    expect(t.subModel.updateOne).not.toHaveBeenCalled();
  });

  it("is idempotent: suspending a suspended account has no side effects", async () => {
    const t = setup({
      customer: {
        _id: CUSTOMER_ID,
        email: "a@b.c",
        role: "OWNER",
        accountStatus: "suspended",
      },
      userUpdateModified: 0,
    });
    const res = await t.service.suspend(ADMIN_ID, CUSTOMER_ID, {
      reason: "again",
    });
    expect(res).toMatchObject({ success: true, alreadySuspended: true });
    expect(t.campaignsService.pauseForSuspension).not.toHaveBeenCalled();
    expect(t.auditModel.create).not.toHaveBeenCalled();
    expect(t.emailService.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it("unsuspends once, resuming only suspension-paused activity", async () => {
    const t = setup({
      customer: {
        _id: CUSTOMER_ID,
        email: "a@b.c",
        role: "OWNER",
        accountStatus: "suspended",
      },
    });
    const res = await t.service.unsuspend(ADMIN_ID, CUSTOMER_ID);
    expect(res).toEqual({ success: true, accountStatus: "active" });
    expect(t.campaignsService.resumeAfterSuspension).toHaveBeenCalledWith([
      CUSTOMER_ID,
    ]);
    // Doesn't touch the subscription (no auto-extend).
    expect(t.subModel.updateOne).not.toHaveBeenCalled();
  });

  it("is idempotent: unsuspending an active account has no side effects", async () => {
    const t = setup({ userUpdateModified: 0 });
    const res = await t.service.unsuspend(ADMIN_ID, CUSTOMER_ID);
    expect(res).toMatchObject({ success: true, alreadyActive: true });
    expect(t.campaignsService.resumeAfterSuspension).not.toHaveBeenCalled();
    expect(t.auditModel.create).not.toHaveBeenCalled();
  });

  it("refuses to manage a platform staff account", async () => {
    const t = setup({
      customer: {
        _id: CUSTOMER_ID,
        email: "staff@x.com",
        role: "OWNER",
        platformRole: "SUPER_ADMIN",
      },
    });
    await expect(
      t.service.suspend(ADMIN_ID, CUSTOMER_ID, { reason: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("AccountManagementService.softDelete", () => {
  it("rejects a confirmEmail that doesn't match, changing nothing", async () => {
    const t = setup({});
    const err = await t.service
      .softDelete(ADMIN_ID, CUSTOMER_ID, {
        reason: "request",
        confirmEmail: "someone-else@example.com",
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(errorCode(err)).toBe("CONFIRM_EMAIL_MISMATCH");
    expect(t.userModel.updateOne).not.toHaveBeenCalled();
    expect(t.razorpayService.cancelSubscription).not.toHaveBeenCalled();
  });

  it("soft-deletes (case-insensitive email), frees email/phone, revokes access and cancels auto-pay", async () => {
    const t = setup({
      sub: {
        plan: "GROWTH",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + DAY),
        razorpaySubId: "sub_live",
      },
    });
    const res = await t.service.softDelete(ADMIN_ID, CUSTOMER_ID, {
      reason: "customer request",
      confirmEmail: "  owner@example.COM ",
    });

    expect(res).toEqual({ success: true });
    expect(t.razorpayService.cancelSubscription).toHaveBeenCalledWith(
      "sub_live",
      false,
    );
    const [, update] = t.userModel.updateOne.mock.calls[0];
    expect(update.$set).toMatchObject({
      accountStatus: "deleted",
      deletedBy: ADMIN_ID,
      deletedEmail: "Owner@Example.com",
      email: `deleted:${CUSTOMER_ID}:Owner@Example.com`,
      deletedPhone: "+919999999999",
    });
    expect(update.$unset).toHaveProperty("phone");
    expect(t.sessionModel.deleteMany).toHaveBeenCalledWith({
      userId: CUSTOMER_ID,
    });
    expect(t.apiKeyModel.updateMany).toHaveBeenCalled();
    expect(t.campaignsService.pauseForSuspension).toHaveBeenCalled();
    // Expiry is kept for audit — only renewal is stopped.
    // Cancelled, but the expiry is kept for audit.
    const [, subUpdate] = t.subModel.updateOne.mock.calls[0];
    expect(subUpdate.$set.status).toBe("CANCELLED");
    expect(subUpdate.$set).not.toHaveProperty("currentPeriodEnd");
  });
});
