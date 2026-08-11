import {
  Controller,
  Post,
  Delete,
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
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";

@Controller("projects/:projectId/upload")
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class UploadProjectController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("image")
  @UseInterceptors(FileInterceptor("file"))
  uploadImage(
    @Request() req: ProjectAuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadImage(req.projectId, file);
  }

  @Post("document")
  @UseInterceptors(FileInterceptor("file"))
  uploadDocument(
    @Request() req: ProjectAuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadDocument(req.projectId, file);
  }

  @Post("audio")
  @UseInterceptors(FileInterceptor("file"))
  uploadAudio(
    @Request() req: ProjectAuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadAudio(req.projectId, file);
  }

  @Delete(":key")
  deleteFile(@Request() req: ProjectAuthReq, @Param("key") key: string) {
    return this.uploadService.deleteFile(req.projectId, key);
  }
}

@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("platform/tutorial")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  uploadPlatformTutorial(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPlatformTutorial(file);
  }

  @Post("platform/image")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  uploadPlatformImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.uploadPlatformImage(file);
  }
}
