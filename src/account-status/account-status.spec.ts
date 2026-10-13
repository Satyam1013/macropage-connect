import { ForbiddenException, HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { Types } from "mongoose";
import { AccountStatusService } from "./account-status.service";
import { JwtStrategy } from "../auth/strategies/jwt.strategy";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { AccountManagementController } from "../platform-admin/account-management/account-management.controller";

function query<T>(result: T) {
  const q = {
    select: () => q,
    lean: () => q,
    exec: () => Promise.resolve(result),
  };
  return q;
}

function code(err: unknown) {
  return ((err as HttpException).getResponse() as { code?: string }).code;
}

const OWNER_ID = new Types.ObjectId().toString();
const PROJECT_ID = new Types.ObjectId().toString();

function statusService(ownerStatus: string | undefined) {
  const tenantModel = {
    findById: (id: string) =>
      query(id === PROJECT_ID ? { ownerId: OWNER_ID } : null),
    find: () => query([]),
  };
  const userModel = {
    findById: () => query({ accountStatus: ownerStatus }),
  };
  return new AccountStatusService(userModel as never, tenantModel as never);
}

describe("AccountStatusService", () => {
  it("blocks a project whose owner is suspended", async () => {
    const svc = statusService("suspended");
    const err = await svc
      .assertTenantActive(PROJECT_ID)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(code(err)).toBe("ACCOUNT_SUSPENDED");
  });

  it("treats accounts without the field as active", async () => {
    const svc = statusService(undefined);
    await expect(svc.assertTenantActive(PROJECT_ID)).resolves.toBeUndefined();
    expect(() => svc.assertUserActive({})).not.toThrow();
  });

  it("reports ACCOUNT_DELETED for deleted users", () => {
    const svc = statusService("active");
    try {
      svc.assertUserActive({ accountStatus: "deleted" });
      fail("expected throw");
    } catch (err) {
      expect(code(err)).toBe("ACCOUNT_DELETED");
    }
  });
});

describe("JwtStrategy (every authenticated request)", () => {
  const config = { get: () => "secret" };

  it("rejects an already-issued token once the user is suspended", async () => {
    const users = {
      findById: jest.fn().mockResolvedValue({
        _id: OWNER_ID,
        accountStatus: "suspended",
      }),
    };
    const strategy = new JwtStrategy(
      config as never,
      users as never,
      statusService("suspended"),
    );
    const err = await strategy
      .validate({ sub: OWNER_ID } as never)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as HttpException).getResponse()).toMatchObject({
      success: false,
      code: "ACCOUNT_SUSPENDED",
    });
  });

  it("rejects a team member of a suspended customer", async () => {
    const member = {
      _id: new Types.ObjectId().toString(),
      tenantId: OWNER_ID,
      accountStatus: "active",
    };
    const strategy = new JwtStrategy(
      config as never,
      { findById: jest.fn().mockResolvedValue(member) } as never,
      statusService("suspended"),
    );
    await expect(
      strategy.validate({ sub: member._id } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets an active user through", async () => {
    const user = { _id: OWNER_ID, accountStatus: "active" };
    const strategy = new JwtStrategy(
      config as never,
      { findById: jest.fn().mockResolvedValue(user) } as never,
      statusService("active"),
    );
    await expect(strategy.validate({ sub: OWNER_ID } as never)).resolves.toBe(
      user,
    );
  });
});

describe("AccountManagementController access", () => {
  const guard = new PlatformRolesGuard(new Reflector());
  const ctx = (user: Record<string, unknown>) =>
    ({
      // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as metadata key
      getHandler: () => AccountManagementController.prototype.suspend,
      getClass: () => AccountManagementController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it("rejects customer (non-staff) tokens", () => {
    expect(() => guard.canActivate(ctx({ role: "OWNER" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects support agents", () => {
    expect(() =>
      guard.canActivate(ctx({ platformRole: "SUPPORT_AGENT" })),
    ).toThrow(ForbiddenException);
  });

  it("allows super admins", () => {
    expect(guard.canActivate(ctx({ platformRole: "SUPER_ADMIN" }))).toBe(true);
  });
});
