import {
  Controller,
  Delete,
  Post,
  Query,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { AdminService } from "./admin.service";

@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkSecret(secret: string | undefined) {
    const expected = process.env.ADMIN_SECRET;
    if (!expected) throw new UnauthorizedException("Admin not configured");
    if (secret !== expected)
      throw new UnauthorizedException("Invalid admin secret");
  }

  @Delete("waba")
  disconnectWaba(
    @Headers("x-admin-secret") secret: string | undefined,
    @Query("email") email: string | undefined,
    @Query("tenantId") tenantId: string | undefined,
  ) {
    this.checkSecret(secret);
    if (tenantId) return this.adminService.disconnectWabaByTenantId(tenantId);
    if (!email)
      throw new BadRequestException("email or tenantId query param required");
    return this.adminService.disconnectWaba(email);
  }

  // ONE-TIME backfill for tenants that connected WhatsApp before
  // metaBusinessId capture existed. Run once, verify the results, then
  // delete this route entirely — it must never remain reachable.
  @Post("backfill-business-ids")
  backfillBusinessIds(@Headers("x-admin-secret") secret: string | undefined) {
    this.checkSecret(secret);
    return this.adminService.backfillBusinessIds();
  }
}
