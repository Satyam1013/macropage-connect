import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Template, TemplateSchema } from "../schemas/template.schema";
import { TemplatesService } from "./templates.service";
import { TemplatesController } from "./templates.controller";
import { MetaModule } from "../meta/meta.module";

import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";
@Module({
  imports: [
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema },
    ]),
    MetaModule,
  ],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
