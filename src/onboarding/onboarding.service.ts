import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Tenant, TenantDocument } from "../schemas/tenant.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";
import { CHECKLIST_STEPS } from "./onboarding.constants";

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
  ) {}

  async getChecklist(tenantId: string, userId: string) {
    const [tenant, owner, user, contactCount, templateCount, campaignCount] =
      await Promise.all([
        this.tenantModel.findById(tenantId).lean().exec(),
        this.userModel.findById(tenantId).lean().exec(),
        this.userModel.findById(userId).select("emailVerified").lean().exec(),
        this.contactModel.countDocuments({ tenantId }),
        this.templateModel.countDocuments({ tenantId }),
        this.campaignModel.countDocuments({
          tenantId,
          status: { $in: ["COMPLETED", "RUNNING"] },
        }),
      ]);

    // tenant is the standalone-account source (Tenant doc); owner is the
    // legacy convention (tenantId === owner User's own _id). Only one of
    // the two will ever exist for a given tenantId.
    const whatsappSetupDone =
      tenant?.whatsappSetupDone ?? owner?.whatsappSetupDone ?? false;
    const onboardingStep = tenant?.onboardingStep ?? owner?.onboardingStep;
    const onboardingComplete =
      tenant?.onboardingComplete ?? owner?.onboardingComplete ?? false;

    const steps = CHECKLIST_STEPS.map((s) => ({
      ...s,
      completed:
        s.step === 1
          ? true
          : s.step === 2
            ? (user?.emailVerified ?? false)
            : s.step === 3
              ? whatsappSetupDone
              : s.step === 4
                ? contactCount > 0
                : s.step === 5
                  ? templateCount > 0
                  : s.step === 6
                    ? campaignCount > 0
                    : false,
    }));

    const completedCount = steps.filter((s) => s.completed).length;
    const currentStep = steps.find((s) => !s.completed)?.step ?? 6;

    if ((tenant || owner) && currentStep !== onboardingStep) {
      if (tenant) {
        await this.tenantModel.updateOne(
          { _id: tenantId },
          { onboardingStep: currentStep },
        );
      } else {
        await this.userModel.findByIdAndUpdate(tenantId, {
          onboardingStep: currentStep,
        });
      }
    }

    return {
      success: true,
      data: {
        steps,
        completedCount,
        totalSteps: CHECKLIST_STEPS.length,
        progressPercent: Math.round(
          (completedCount / CHECKLIST_STEPS.length) * 100,
        ),
        currentStep,
        isComplete: onboardingComplete,
      },
    };
  }

  async completeStep(tenantId: string, step: number) {
    const isTenant = await this.tenantModel.exists({ _id: tenantId });
    const update = { onboardingStep: Math.max(step + 1, 1) };
    if (isTenant) {
      await this.tenantModel.updateOne({ _id: tenantId }, update);
    } else {
      await this.userModel.findByIdAndUpdate(tenantId, update);
    }
    return { success: true };
  }

  async dismiss(tenantId: string) {
    const isTenant = await this.tenantModel.exists({ _id: tenantId });
    const update = { onboardingComplete: true };
    if (isTenant) {
      await this.tenantModel.updateOne({ _id: tenantId }, update);
    } else {
      await this.userModel.findByIdAndUpdate(tenantId, update);
    }
    return { success: true };
  }
}
