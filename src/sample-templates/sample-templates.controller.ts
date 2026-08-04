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
import { SampleTemplatesService } from "./sample-templates.service";
import { CreateSampleTemplateDto } from "./dto/create-sample-template.dto";
import { UpdateSampleTemplateDto } from "./dto/update-sample-template.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";

// Tenant-facing reads (below) stay read-only and JwtAuthGuard-only — sample
// templates used to be curated exclusively from the admin panel against the
// same `sampletemplates` collection. The /platform routes port that CRUD in
// from admin's now-deleted TemplatesController, gated to platform staff via
// PlatformRolesGuard (checks `platformRole`, never the tenant-scoped
// `role`/RolesGuard) so a tenant's own "ADMIN" can never reach them.
@Controller("sample-templates")
export class SampleTemplatesController {
  constructor(
    private readonly sampleTemplatesService: SampleTemplatesService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query("category") category?: string) {
    return this.sampleTemplatesService.findAll(category);
  }

  @Get("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findAllForPlatform(@Query("category") category?: string) {
    return this.sampleTemplatesService.findAllForPlatform(category);
  }

  @Get("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  findOneForPlatform(@Param("id") id: string) {
    return this.sampleTemplatesService.findOneForPlatform(id);
  }

  @Post("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  create(@Body() dto: CreateSampleTemplateDto) {
    return this.sampleTemplatesService.create(dto);
  }

  @Patch("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateSampleTemplateDto) {
    return this.sampleTemplatesService.update(id, dto);
  }

  @Delete("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  remove(@Param("id") id: string) {
    return this.sampleTemplatesService.remove(id);
  }

  // NOTE: this route must stay below /platform and /platform/:id so it
  // doesn't shadow them — Nest matches routes in declaration order.
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string) {
    return this.sampleTemplatesService.findOne(id);
  }
}
