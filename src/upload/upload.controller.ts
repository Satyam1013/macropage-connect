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
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string } };

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
}
