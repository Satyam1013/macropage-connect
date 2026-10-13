import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../../users/schemas/user.schema";
import {
  Subscription,
  SubscriptionSchema,
} from "../../schemas/subscription.schema";
import {
  SubscriptionHistory,
  SubscriptionHistorySchema,
} from "../../schemas/subscription-history.schema";
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from "../../schemas/admin-audit-log.schema";
import {
  WebhookEndpoint,
  WebhookEndpointSchema,
} from "../../schemas/webhook-endpoint.schema";
import { APIKey, APIKeySchema } from "../../schemas/api-key.schema";
import { Session, SessionSchema } from "../../schemas/session.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "../../schemas/refresh-token.schema";
import { TeamInvite, TeamInviteSchema } from "../../schemas/team-invite.schema";
import { BillingModule } from "../../billing/billing.module";
import { CampaignsModule } from "../../campaigns/campaigns.module";
import { GatewayModule } from "../../gateway/gateway.module";
import { QueueModule } from "../../queue/queue.module";
import { NotificationsModule } from "../../notifications/notifications.module";
import { AccountManagementService } from "./account-management.service";
import { AccountManagementController } from "./account-management.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionHistory.name, schema: SubscriptionHistorySchema },
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
      { name: APIKey.name, schema: APIKeySchema },
      { name: Session.name, schema: SessionSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: TeamInvite.name, schema: TeamInviteSchema },
    ]),
    BillingModule,
    CampaignsModule,
    GatewayModule,
    QueueModule,
    NotificationsModule,
  ],
  controllers: [AccountManagementController],
  providers: [AccountManagementService],
})
export class AccountManagementModule {}
