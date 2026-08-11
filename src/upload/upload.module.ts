import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MulterModule } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { UploadController, UploadProjectController } from "./upload.controller";
import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";

@Module({
  imports: [
    MulterModule.register({ limits: { fileSize: 20 * 1024 * 1024 } }),
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
  ],
  providers: [UploadService],
  controllers: [UploadController, UploadProjectController],
  exports: [UploadService],
})
export class UploadModule {}
