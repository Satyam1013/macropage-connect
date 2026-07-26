import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  HttpCode,
  HttpStatus,
  Header,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UploadService } from "../upload/upload.service";
import type { AuthReq } from "../auth/dto/auth-request.interface";

class UpdateProfileDto {
  name?: string;
  bio?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  department?: string;
  jobTitle?: string;
  timezone?: string;
  language?: string;
  company?: string;
  avatarUrl?: string;
}

// Bare /api/v1/me alias for /api/v1/users/me — some frontend calls hit this
// path directly instead of the users-prefixed one.
@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-cache, no-store, must-revalidate")
  async getMe(@Request() req: AuthReq) {
    const user = await this.usersService.findById(req.user.id);
    return {
      success: true,
      data: {
        user: user && {
          ...user.toObject(),
          avatarUrl: user.avatarUrl ?? null,
        },
      },
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateMe(@Request() req: AuthReq, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(req.user.id, dto);
    return {
      success: true,
      data: {
        user: updated && {
          ...updated.toObject(),
          avatarUrl: updated.avatarUrl ?? null,
        },
      },
    };
  }

  @Post("avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadAvatar(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const tenantId = req.user.tenantId ?? req.user.id;
    const { url } = await this.uploadService.uploadImage(tenantId, file);
    await this.usersService.updateProfile(req.user.id, { avatarUrl: url });
    return { success: true, data: { avatarUrl: url } };
  }
}
