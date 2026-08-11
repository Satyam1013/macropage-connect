import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

// Resolves the two "who does tenantId belong to" conventions this app has:
//   - legacy: tenantId IS an owner User's own _id (owner never has a
//     `tenantId` field set on their own doc — see the comment repeated
//     across webhook.service.ts, team.service.ts, billing.service.ts).
//   - standalone Tenant docs (created via POST /auth/create-project),
//     which carry their own `ownerId` pointing at the actual person.
// Every "who do I notify/email for this tenant" call site should go
// through resolveOwnerId() instead of `userModel.findById(tenantId)`
// directly, or it silently breaks for standalone tenants.
@Injectable()
export class TenantResolverService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async resolveOwnerId(tenantId: string): Promise<string | undefined> {
    const tenant = await this.tenantModel
      .findById(tenantId)
      .select("ownerId")
      .lean()
      .exec();
    if (tenant) return tenant.ownerId;

    const owner = await this.userModel
      .findById(tenantId)
      .select("_id")
      .lean()
      .exec();
    return owner ? String(owner._id) : undefined;
  }

  // True if tenantId is a standalone Tenant document (vs. the legacy
  // owner-User-doc-as-tenant convention).
  isStandaloneTenant(tenantId: string): Promise<boolean> {
    return this.tenantModel.exists({ _id: tenantId }).then((r) => r !== null);
  }

  async resolveLocation(
    tenantId: string,
  ): Promise<{ city?: string; country?: string } | null> {
    const tenant = await this.tenantModel
      .findById(tenantId)
      .select("city country")
      .lean()
      .exec();
    if (tenant) return { city: tenant.city, country: tenant.country };

    const owner = await this.userModel
      .findById(tenantId)
      .select("city country")
      .lean()
      .exec();
    return owner ? { city: owner.city, country: owner.country } : null;
  }

  // Billing is a property of a person's own MAIN account only — sub
  // accounts they create (POST /auth/create-project) share the main
  // account's plan rather than carrying their own Subscription. Redirects
  // to userId when currentTenantId is either userId itself, or a
  // standalone Tenant the caller personally owns. Leaves currentTenantId
  // untouched when it belongs to someone else's business (an invited
  // team member, even one invited as OWNER-role co-admin) — that tenant's
  // billing is genuinely independent, not the invitee's own.
  async resolveBillingTenantId(
    userId: string,
    currentTenantId: string,
  ): Promise<string> {
    if (currentTenantId === userId) return userId;

    const tenant = await this.tenantModel
      .findById(currentTenantId)
      .select("ownerId")
      .lean()
      .exec();
    if (tenant && tenant.ownerId === userId) return userId;

    return currentTenantId;
  }
}
