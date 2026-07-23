import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { SampleTemplatesService } from "./sample-templates.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// Read-only for the Connect portal — sample templates are curated in the
// admin panel (separate service) against the same `sampletemplates`
// collection, so this exposes no create/update/delete routes.
@UseGuards(JwtAuthGuard)
@Controller("sample-templates")
export class SampleTemplatesController {
  constructor(
    private readonly sampleTemplatesService: SampleTemplatesService,
  ) {}

  @Get()
  findAll(@Query("category") category?: string) {
    return this.sampleTemplatesService.findAll(category);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.sampleTemplatesService.findOne(id);
  }
}
