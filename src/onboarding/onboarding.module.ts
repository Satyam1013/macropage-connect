import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { Contact, ContactSchema } from "../schemas/contact.schema";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
