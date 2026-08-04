import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IntegrationPlatformsService } from "./integration-platforms.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";
import { CreateIntegrationPlatformDto } from "./dto/create-integration-platform.dto";
import { UpdateIntegrationPlatformDto } from "./dto/update-integration-platform.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { QueryIntegrationPlatformsDto } from "./dto/query-integration-platforms.dto";

// Tenant-facing routes below are read-only. Platform-staff CRUD lives under
// /integration-platforms/platform/... guarded by PlatformRolesGuard — same
// `integrationplatforms` collection, curated by SUPER_ADMIN platform staff.
@Controller("integration-platforms")
export class IntegrationPlatformsController {
  constructor(
    private readonly integrationPlatformsService: IntegrationPlatformsService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query("category") category?: string,
    @Query("search") search?: string,
  ) {
    return this.integrationPlatformsService.findAll(category, search);
  }

  @Get("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findAllForPlatform(@Query() query: QueryIntegrationPlatformsDto) {
    return this.integrationPlatformsService.findAllForPlatform(query);
  }

  @Get("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findOneForPlatform(@Param("id") id: string) {
    return this.integrationPlatformsService.findOneForPlatform(id);
  }

  @Post("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  create(@Body() dto: CreateIntegrationPlatformDto) {
    return this.integrationPlatformsService.create(dto);
  }

  @Patch("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateIntegrationPlatformDto) {
    return this.integrationPlatformsService.update(id, dto);
  }

  @Patch("platform/:id/status")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.integrationPlatformsService.updateStatus(id, dto);
  }

  @Delete("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.integrationPlatformsService.remove(id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string) {
    return this.integrationPlatformsService.findOne(id);
  }
}
