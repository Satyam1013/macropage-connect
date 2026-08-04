import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PlatformCustomersService } from "./customers.service";
import { QueryCustomersDto } from "./dto/query-customers.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../../common/guards/platform-roles.guard";
import { PlatformRoles } from "../../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";

@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
@Controller("platform/customers")
export class PlatformCustomersController {
  constructor(private readonly customersService: PlatformCustomersService) {}

  @Get()
  findAll(@Query() query: QueryCustomersDto) {
    return this.customersService.findAll(query);
  }

  @Get("dashboard-stats")
  getDashboardStats() {
    return this.customersService.getDashboardStats();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Get(":id/profile")
  getProfile(@Param("id") id: string) {
    return this.customersService.getProfile(id);
  }
}
