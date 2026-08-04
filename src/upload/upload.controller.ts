import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("image")
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.uploadService.uploadImage(tenantId, file);
  }

  @Post("document")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.uploadService.uploadDocument(tenantId, file);
  }

  @Post("audio")
  @UseInterceptors(FileInterceptor("file"))
  uploadAudio(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.uploadService.uploadAudio(tenantId, file);
  }

  @Delete(":key")
  deleteFile(@Request() req: AuthReq, @Param("key") key: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.uploadService.deleteFile(tenantId, key);
  }

  @Post("platform/tutorial")
  @UseGuards(PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  uploadPlatformTutorial(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPlatformTutorial(file);
  }

  @Post("platform/image")
  @UseGuards(PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  uploadPlatformImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPlatformImage(file);
  }
}
