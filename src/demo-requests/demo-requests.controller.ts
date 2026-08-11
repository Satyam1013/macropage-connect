import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { DemoRequestsService } from "./demo-requests.service";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";
import { UpdateDemoRequestDto } from "./dto/update-demo-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";

@Controller("projects/:projectId/demo-requests")
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class DemoRequestsProjectController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: ProjectAuthReq, @Body() dto: CreateDemoRequestDto) {
    return this.demoRequestsService.create(
      req.projectId,
      { id: req.user.id, name: req.user.name, email: req.user.email },
      dto,
    );
  }
}

@Controller("demo-requests")
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Get("platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  findAllForPlatform(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
    @Query("tenantId") tenantId?: string,
  ) {
    return this.demoRequestsService.findAllForPlatform({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      tenantId,
    });
  }

  @Get("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  findOneForPlatform(@Param("id") id: string) {
    return this.demoRequestsService.findOneForPlatform(id);
  }

  @Patch("platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  updateStatus(@Param("id") id: string, @Body() dto: UpdateDemoRequestDto) {
    return this.demoRequestsService.updateStatus(id, dto);
  }
}
