import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { QrMessage, QrMessageSchema } from "../schemas/qr-message.schema";
import { QrMessageService } from "./qr-message.service";
import { QrMessageController } from "./qr-message.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QrMessage.name, schema: QrMessageSchema },
    ]),
  ],
  providers: [QrMessageService],
  controllers: [QrMessageController],
  exports: [QrMessageService],
})
export class QrMessageModule {}
