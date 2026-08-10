import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { MeController } from "./me.controller";
import { ActivityService } from "./activity.service";
import { User, UserSchema } from "./schemas/user.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { ActivityLog, ActivityLogSchema } from "../schemas/activity-log.schema";
import { UploadModule } from "../upload/upload.module";
import { BillingModule } from "../billing/billing.module";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    UploadModule,
    BillingModule,
    TenantModule,
  ],
  controllers: [UsersController, MeController],
  providers: [UsersService, ActivityService],
  exports: [UsersService, ActivityService],
})
export class UsersModule {}
