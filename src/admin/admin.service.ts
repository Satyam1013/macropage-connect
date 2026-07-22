import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WABAAccount,
  WABAAccountDocument,
} from "../schemas/waba-account.schema";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectModel(WABAAccount.name)
    private readonly wabaModel: Model<WABAAccountDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
    await this.userModel.updateOne(
      { $or: [{ _id: tenantId }, { tenantId }] },
      { $set: { whatsappSetupDone: false } },
    );
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
}
