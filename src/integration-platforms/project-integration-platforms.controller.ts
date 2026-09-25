import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { IntegrationPlatformsService } from "./integration-platforms.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";

// Tenant-facing, read-only. The catalog itself is global (curated by
// platform staff), but the app calls it under the project-scoped URL like
// every other tenant route, so it needs to be reachable at
// /projects/:projectId/integration-platforms too. Staff CRUD stays on the
// unscoped IntegrationPlatformsController.
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/integration-platforms")
export class ProjectIntegrationPlatformsController {
  constructor(
    private readonly integrationPlatformsService: IntegrationPlatformsService,
  ) {}

  @Get()
  findAll(
    @Query("category") category?: string,
    @Query("search") search?: string,
  ) {
    return this.integrationPlatformsService.findAll(category, search);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.integrationPlatformsService.findOne(id);
  }
}
