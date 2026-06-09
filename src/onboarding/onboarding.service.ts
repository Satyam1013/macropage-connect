import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Contact, ContactDocument } from "../schemas/contact.schema";
import { Template, TemplateDocument } from "../schemas/template.schema";
import { Campaign, CampaignDocument } from "../schemas/campaign.schema";

const CHECKLIST_STEPS = [
  {
    step: 1,
    title: "Create your account",
    description: "Sign up for Macropage Connect",
    link: null as string | null,
  },
  {
    step: 2,
    title: "Verify your email",
    description: "Confirm your email address",
    link: null as string | null,
  },
  {
    step: 3,
    title: "Connect WhatsApp",
    description: "Link your WhatsApp Business Account",
    link: "/setup/whatsapp",
  },
  {
    step: 4,
    title: "Import contacts",
    description: "Upload your contact list",
    link: "/contacts",
  },
  {
    step: 5,
    title: "Create a template",
    description: "Set up your first message template",
    link: "/campaigns/templates",
  },
  {
    step: 6,
    title: "Send your first campaign",
    description: "Broadcast to your contacts",
    link: "/campaigns",
  },
];

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Template.name)
    private readonly templateModel: Model<TemplateDocument>,
    @InjectModel(Campaign.name)
    private readonly campaignModel: Model<CampaignDocument>,
  ) {}

  async getChecklist(tenantId: string, userId: string) {
    const [owner, user, contactCount, templateCount, campaignCount] =
      await Promise.all([
        this.userModel.findById(tenantId).lean().exec(),
        this.userModel
          .findById(userId)
          .select("emailVerified")
          .lean()
          .exec(),
        this.contactModel.countDocuments({ tenantId }),
        this.templateModel.countDocuments({ tenantId }),
        this.campaignModel.countDocuments({
          tenantId,
          status: { $in: ["COMPLETED", "RUNNING"] },
        }),
      ]);

    const steps = CHECKLIST_STEPS.map((s) => ({
      ...s,
      completed:
        s.step === 1
          ? true
          : s.step === 2
            ? (user?.emailVerified ?? false)
            : s.step === 3
              ? (owner?.whatsappSetupDone ?? false)
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

    if (owner && currentStep !== owner.onboardingStep) {
      await this.userModel.findByIdAndUpdate(tenantId, {
        onboardingStep: currentStep,
      });
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
        isComplete: owner?.onboardingComplete ?? false,
      },
    };
  }

  async completeStep(tenantId: string, step: number) {
    await this.userModel.findByIdAndUpdate(tenantId, {
      onboardingStep: Math.max(step + 1, 1),
    });
    return { success: true };
  }

  async dismiss(tenantId: string) {
    await this.userModel.findByIdAndUpdate(tenantId, {
      onboardingComplete: true,
    });
    return { success: true };
  }
}
