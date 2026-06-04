import { Module } from "@nestjs/common";
import { HelpService } from "./help.service";
import { HelpController } from "./help.controller";

@Module({
  providers: [HelpService],
  controllers: [HelpController],
})
export class HelpModule {}
