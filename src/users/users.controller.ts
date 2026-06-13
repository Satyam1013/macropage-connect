import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UsersService } from "./users.service";
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

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  async getMe(@Request() req: AuthReq) {
    const user = await this.usersService.findById(req.user.id);
    return { success: true, data: { user } };
  }

  @Put("me")
  @HttpCode(HttpStatus.OK)
  async updateMe(@Request() req: AuthReq, @Body() dto: UpdateProfileDto) {
    const updated = await this.usersService.updateProfile(req.user.id, dto);
    return { success: true, data: { user: updated } };
  }
}
