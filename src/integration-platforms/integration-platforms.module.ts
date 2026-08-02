import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  IntegrationPlatform,
  IntegrationPlatformSchema,
} from "../schemas/integration-platform.schema";
import { IntegrationPlatformsService } from "./integration-platforms.service";
import { IntegrationPlatformsController } from "./integration-platforms.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationPlatform.name, schema: IntegrationPlatformSchema },
    ]),
  ],
  providers: [IntegrationPlatformsService],
  controllers: [IntegrationPlatformsController],
})
export class IntegrationPlatformsModule {}
