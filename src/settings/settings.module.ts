import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { APIKey, APIKeySchema } from "../schemas/api-key.schema";
import {
  WebhookEndpoint,
  WebhookEndpointSchema,
} from "../schemas/webhook-endpoint.schema";
import { SettingsService } from "./settings.service";
import { SettingsController } from "./settings.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: APIKey.name, schema: APIKeySchema },
      { name: WebhookEndpoint.name, schema: WebhookEndpointSchema },
    ]),
  ],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
