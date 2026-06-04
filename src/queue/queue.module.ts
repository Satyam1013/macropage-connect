import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailProcessor } from "./processors/email.processor";

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "emails" },
      { name: "campaigns" },
      { name: "imports" },
      { name: "webhooks" },
    ),
  ],
  providers: [EmailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
