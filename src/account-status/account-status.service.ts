import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";

export type AccountStatus = "active" | "suspended" | "deleted";

const BLOCKED_ERRORS: Record<
  Exclude<AccountStatus, "active">,
  { code: string; message: string }
> = {
  suspended: {
    code: "ACCOUNT_SUSPENDED",
    message:
      "This account has been suspended. Contact Macropage support for help.",
  },
  deleted: {
    code: "ACCOUNT_DELETED",
    message: "This account has been deleted.",
  },
};

export function accountBlockedException(status: AccountStatus) {
  if (status === "active") return null;
  return new ForbiddenException({ success: false, ...BLOCKED_ERRORS[status] });
}

/**
 * Single place that decides whether a customer account (and everything
 * under it) may be used. A "customer" is an OWNER user; their projects are
 * the legacy tenant whose id IS their _id plus every standalone Tenant
 * with ownerId = their _id. Suspending/deleting the customer blocks:
 *   - the customer's own requests (JwtStrategy → assertUserActive),
 *   - anyone acting inside one of their projects — team members, API keys,
 *     sockets, outbound sends (assertTenantActive).
 */
@Injectable()
export class AccountStatusService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
  ) {}

  /** Throws 403 ACCOUNT_SUSPENDED / ACCOUNT_DELETED for a blocked user. */
  assertUserActive(user: { accountStatus?: string | null }): void {
    const err = accountBlockedException(
      (user.accountStatus ?? "active") as AccountStatus,
    );
    if (err) throw err;
  }

  /** Status of the customer who owns tenantId ("active" if unknown). */
  async getTenantStatus(tenantId: string): Promise<AccountStatus> {
    if (!Types.ObjectId.isValid(tenantId)) return "active";

    const tenant = await this.tenantModel
      .findById(tenantId)
      .select("ownerId")
      .lean()
      .exec();
    const ownerId = tenant?.ownerId ?? tenantId;
    if (!Types.ObjectId.isValid(ownerId)) return "active";

    const owner = await this.userModel
      .findById(ownerId)
      .select("accountStatus")
      .lean()
      .exec();
    return owner?.accountStatus ?? "active";
  }

  async isTenantBlocked(tenantId: string): Promise<boolean> {
    return (await this.getTenantStatus(tenantId)) !== "active";
  }

  /** Throws 403 when the customer owning tenantId is suspended/deleted. */
  async assertTenantActive(tenantId: string): Promise<void> {
    const err = accountBlockedException(await this.getTenantStatus(tenantId));
    if (err) throw err;
  }

  /** Every tenant id the customer owns (legacy own-id + standalone). */
  async ownedTenantIds(customerId: string): Promise<string[]> {
    const tenants = await this.tenantModel
      .find({ ownerId: customerId })
      .select("_id")
      .lean()
      .exec();
    return [...new Set([customerId, ...tenants.map((t) => String(t._id))])];
  }
}
