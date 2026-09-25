import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  IntegrationPlatform,
  IntegrationPlatformSchema,
} from "../schemas/integration-platform.schema";
import { IntegrationPlatformsService } from "./integration-platforms.service";
import { IntegrationPlatformsController } from "./integration-platforms.controller";
import { ProjectIntegrationPlatformsController } from "./project-integration-platforms.controller";
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
      { name: IntegrationPlatform.name, schema: IntegrationPlatformSchema },
    ]),
  ],
  providers: [IntegrationPlatformsService],
  controllers: [
    IntegrationPlatformsController,
    ProjectIntegrationPlatformsController,
  ],
})
export class IntegrationPlatformsModule {}
