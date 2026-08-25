import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { ConnectCatalogDto } from "./dto/connect-catalog.dto";
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
  // product creation. Body carries the access token from the Facebook
  // popup (launchCatalogConnect() on the frontend).
  @Post("connect")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  connect(@Request() req: ProjectAuthReq, @Body() dto: ConnectCatalogDto) {
    return this.catalogService.connectCatalog(req.projectId, dto.accessToken);
  }

  // Reconnect also requires a fresh popup token — there's no server-side-only
  // reconnect path since the catalog is chosen inside the popup each time.
  @Post("reconnect")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  reconnect(@Request() req: ProjectAuthReq, @Body() dto: ConnectCatalogDto) {
    return this.catalogService.connectCatalog(req.projectId, dto.accessToken);
  }
}
