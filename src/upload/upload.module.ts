import { Module } from "@nestjs/common";
import { MulterModule } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { UploadController } from "./upload.controller";

@Module({
  imports: [MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } })],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
