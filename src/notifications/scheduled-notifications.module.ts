import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { Message, MessageSchema } from "../schemas/message.schema";
import { Campaign, CampaignSchema } from "../schemas/campaign.schema";
import { NotificationsModule } from "./notifications.module";
import { ScheduledNotificationsService } from "./scheduled-notifications.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Campaign.name, schema: CampaignSchema },
    ]),
    NotificationsModule,
  ],
  providers: [ScheduledNotificationsService],
})
export class ScheduledNotificationsModule {}
