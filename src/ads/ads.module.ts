import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Ad, AdSchema } from "../schemas/ad.schema";
import { AdTag, AdTagSchema } from "../schemas/ad-tag.schema";
import { AdsService } from "./ads.service";
import { AdsController, AdsProjectController } from "./ads.controller";
import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ad.name, schema: AdSchema },
      { name: AdTag.name, schema: AdTagSchema },
    ]),
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
  ],
  providers: [AdsService],
  controllers: [AdsController, AdsProjectController],
})
export class AdsModule {}
