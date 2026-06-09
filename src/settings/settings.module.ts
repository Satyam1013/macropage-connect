import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APIKey, APIKeySchema } from "../schemas/api-key.schema";
import {
  WebhookEndpoint,
  WebhookEndpointSchema,
} from "../schemas/webhook-endpoint.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { UploadModule } from "../upload/upload.module";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: APIKey.name, schema: APIKeySchema },
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
      { name: User.name, schema: UserSchema },
    ]),
    UploadModule,
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
