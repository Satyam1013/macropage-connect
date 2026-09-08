import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APIKey, APIKeySchema } from "../schemas/api-key.schema";
import {
  WebhookEndpoint,
  WebhookEndpointSchema,
} from "../schemas/webhook-endpoint.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { UploadModule } from "../upload/upload.module";
import { BillingModule } from "../billing/billing.module";
import { TenantModule } from "../tenant/tenant.module";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";

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
      { name: APIKey.name, schema: APIKeySchema },
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    UploadModule,
    BillingModule,
    TenantModule,
  ],
  providers: [SettingsService, ApiKeyGuard],
  controllers: [SettingsController],
  exports: [SettingsService, ApiKeyGuard],
})
export class SettingsModule {}
