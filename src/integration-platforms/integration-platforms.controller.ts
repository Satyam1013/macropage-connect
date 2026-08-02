import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { IntegrationPlatformsService } from "./integration-platforms.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// Read-only for the Connect portal — integration platforms are curated in
// the admin panel (separate service) against the same `integrationplatforms`
// collection, so this exposes no create/update/delete routes.
@UseGuards(JwtAuthGuard)
@Controller("integration-platforms")
export class IntegrationPlatformsController {
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
