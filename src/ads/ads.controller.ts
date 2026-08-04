import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AdsService } from "./ads.service";
import { CreateAdDto } from "./dto/create-ad.dto";
import { UpdateAdDto } from "./dto/update-ad.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@Controller("ads")
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // Only currently-active ads targeted at the logged-in tenant.
  @Get()
  @UseGuards(JwtAuthGuard)
  findActive(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.adsService.findActive(tenantId);
  }

  @Get("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findAllForPlatform(@Query("category") category?: string) {
    return this.adsService.findAllForPlatform(category);
  }

  @Get("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findOneForPlatform(@Param("id") id: string) {
    return this.adsService.findOneForPlatform(id);
  }

  @Post("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  create(@Body() dto: CreateAdDto) {
    return this.adsService.create(dto);
  }

  @Patch("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateAdDto) {
    return this.adsService.update(id, dto);
  }

  @Delete("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.adsService.remove(id);
  }
}
