import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { MetaService } from "./meta.service";
import { EncryptionService } from "./encryption.service";
import { User, UserSchema } from "../users/schemas/user.schema";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  providers: [MetaService, EncryptionService],
  exports: [MetaService, EncryptionService],
})
export class MetaModule {}
