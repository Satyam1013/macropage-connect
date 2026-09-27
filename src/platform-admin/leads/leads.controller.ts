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
import { PlatformLeadsService } from "./leads.service";
import { QueryLeadsDto } from "./dto/query-leads.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { UpdateLeadStageDto } from "./dto/update-lead-stage.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../../common/guards/platform-roles.guard";
import { PlatformRoles } from "../../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";
import type { AuthReq } from "../../auth/dto/auth-request.interface";

const tenantOf = (req: AuthReq) => req.user.tenantId ?? req.user.id;

@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
@Controller("platform/leads")
export class PlatformLeadsController {
  constructor(private readonly leadsService: PlatformLeadsService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query() query: QueryLeadsDto) {
    return this.leadsService.findAll(tenantOf(req), query);
  }

  // Declared before any :id route so "stats" isn't captured as an id.
  @Get("stats")
  getStats(@Request() req: AuthReq) {
    return this.leadsService.getStats(tenantOf(req));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(tenantOf(req), dto);
  }

  @Patch(":id/stage")
  updateStage(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: UpdateLeadStageDto,
  ) {
    return this.leadsService.updateStage(tenantOf(req), id, dto.stage);
  }
}
