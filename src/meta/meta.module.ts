import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { MetaService } from "./meta.service";
import { EncryptionService } from "./encryption.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { TenantModule } from "../tenant/tenant.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
    ]),
    NotificationsModule,
    TenantModule,
  ],
  providers: [MetaService, EncryptionService],
  exports: [MetaService, EncryptionService],
})
export class MetaModule {}
