import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EmailService } from "./email.service";

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL", "redis://localhost:6379"),
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 20,
          attempts: 3,
          backoff: { type: "exponential", delay: 10000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: "campaigns" },
      { name: "imports" },
      { name: "webhooks" },
    ),
  ],
  providers: [EmailService],
  exports: [BullModule, EmailService],
})
export class QueueModule {}
