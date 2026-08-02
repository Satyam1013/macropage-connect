import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { AdsService } from "./ads.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

// Read-only for the Connect portal — ads are curated in the admin panel
// (separate service) against the same `ads`/`tags` collections, so this
// exposes no create/update/delete routes. Only currently-active ads
// targeted at the logged-in tenant are returned.
@UseGuards(JwtAuthGuard)
@Controller("ads")
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  findActive(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.adsService.findActive(tenantId);
  }
}
