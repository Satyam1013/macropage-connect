import { Controller, Get, Post, UseGuards, Request } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/auth.constants";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard, RolesGuard)
@Controller("projects/:projectId/catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // Check connection status — called on page load
  @Get("status")
  getStatus(@Request() req: ProjectAuthReq) {
    return this.catalogService.getStatus(req.projectId);
  }

  // Explicit connect action — user-initiated, NOT triggered silently by
  // product creation
  @Post("connect")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  connect(@Request() req: ProjectAuthReq) {
    return this.catalogService.connectCatalog(req.projectId);
  }

  // Allow retry/reconnect if something changes on Meta's side later
  // (token refresh etc)
  @Post("reconnect")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reconnect(@Request() req: ProjectAuthReq) {
    return this.catalogService.connectCatalog(req.projectId, true);
  }
}
