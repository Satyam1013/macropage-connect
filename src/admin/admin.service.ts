import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import axios from "axios";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { TenantResolverService } from "../tenant/tenant-resolver.service";
import { EncryptionService } from "../meta/encryption.service";
import { META_GRAPH_BASE } from "../meta/meta.constants";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    private readonly tenantResolver: TenantResolverService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async disconnectWabaByTenantId(tenantId: string) {
    const waba = await this.wabaModel.findOne({ tenantId }).lean().exec();
    if (!waba) {
      return {
        success: true,
        data: { message: "No WABAAccount found — nothing to delete", tenantId },
      };
    }
    this.logger.log(
      `[Admin] Deleting WABAAccount for tenantId=${tenantId}, phoneNumberId=${waba.phoneNumberId ?? "empty"}`,
    );
    await this.wabaModel.deleteOne({ tenantId });
    const ownerId = await this.tenantResolver.resolveOwnerId(tenantId);
    await Promise.all([
      this.userModel.updateOne(
        {
          $or: [
            { _id: tenantId },
            { tenantId },
            ...(ownerId ? [{ _id: ownerId }] : []),
          ],
        },
        { $set: { whatsappSetupDone: false } },
      ),
      this.tenantModel.updateOne(
        { _id: tenantId },
        { $set: { whatsappSetupDone: false } },
      ),
    ]);
    return {
      success: true,
      data: {
        message: "WABAAccount deleted",
        tenantId,
        deletedPhoneNumberId: waba.phoneNumberId ?? "(was empty)",
        deletedWabaId: waba.wabaId,
      },
    };
  }

  async disconnectWaba(email: string) {
    const user = await this.userModel.findOne({ email }).lean().exec();
    if (!user) throw new NotFoundException(`User not found: ${email}`);

    const tenantId = user.tenantId ?? String(user._id);

    const waba = await this.wabaModel.findOne({ tenantId }).lean().exec();
    if (!waba) {
      this.logger.warn(`[Admin] No WABAAccount for tenant ${tenantId}`);
      return {
        success: true,
        data: { message: "No WABAAccount found — nothing to delete", tenantId },
      };
    }

    this.logger.log(
      `[Admin] Deleting WABAAccount for tenant ${tenantId} (${email}), phoneNumberId=${waba.phoneNumberId ?? "empty"}`,
    );

    await this.wabaModel.deleteOne({ tenantId });

    // Reset onboarding flags on the user so setup wizard shows again
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { whatsappSetupDone: false } },
    );

    return {
      success: true,
      data: {
        message: "WABAAccount deleted — user can reconnect WhatsApp",
        email,
        tenantId,
        deletedPhoneNumberId: waba.phoneNumberId ?? "(was empty)",
        deletedWabaId: waba.wabaId,
      },
    };
  }

  // ONE-TIME backfill for tenants that connected WhatsApp before
  // metaBusinessId capture existed — run once via the admin route, verify
  // the results, then remove the route. Never meant to stay live.
  async backfillBusinessIds() {
    const wabasNeedingFix = await this.wabaModel.find({
      metaConnected: true,
      $or: [{ metaBusinessId: null }, { metaBusinessId: { $exists: false } }],
    });

    const results: Array<{
      tenantId: string;
      status: "fixed" | "no_business_id_found" | "failed";
      metaBusinessId?: string;
      error?: string;
    }> = [];

    for (const waba of wabasNeedingFix) {
      try {
        const accessToken = this.encryptionService.decrypt(waba.accessToken);
        const response = await axios.get(`${META_GRAPH_BASE}/${waba.wabaId}`, {
          params: {
            fields: "on_behalf_of_business_info",
            access_token: accessToken,
          },
        });

        const metaBusinessId = (
          response.data as { on_behalf_of_business_info?: { id?: string } }
        ).on_behalf_of_business_info?.id;

        if (metaBusinessId) {
          await this.wabaModel.updateOne(
            { _id: waba._id },
            { $set: { metaBusinessId } },
          );
          results.push({
            tenantId: waba.tenantId,
            status: "fixed",
            metaBusinessId,
          });
        } else {
          results.push({
            tenantId: waba.tenantId,
            status: "no_business_id_found",
          });
        }
      } catch (err) {
        results.push({
          tenantId: waba.tenantId,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { success: true, data: results };
  }
}
