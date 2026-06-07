import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappController } from "./whatsapp.controller";
import { MetaModule } from "../meta/meta.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MetaModule,
  ],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
