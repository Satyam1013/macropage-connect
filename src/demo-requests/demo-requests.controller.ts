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
import type { AuthReq } from "../auth/dto/auth-request.interface";

@Controller("demo-requests")
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  create(@Request() req: AuthReq, @Body() dto: CreateDemoRequestDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.demoRequestsService.create(
      tenantId,
      { id: req.user.id, name: req.user.name, email: req.user.email },
      dto,
    );
  }

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
