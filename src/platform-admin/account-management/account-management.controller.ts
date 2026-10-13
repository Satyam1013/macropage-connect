import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AccountManagementService } from "./account-management.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { ExtendSubscriptionDto } from "./dto/extend-subscription.dto";
import { SuspendCustomerDto } from "./dto/suspend-customer.dto";
import { DeleteCustomerDto } from "./dto/delete-customer.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../../common/guards/platform-roles.guard";
import { PlatformRoles } from "../../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";
import type { AuthReq } from "../../auth/dto/auth-request.interface";

// Billing and account-lifecycle actions on a customer — SUPER_ADMIN only.
// Same base path and auth as PlatformCustomersController's reads.
@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@Controller("platform/customers")
export class AccountManagementController {
  constructor(private readonly service: AccountManagementService) {}

  @Post(":id/subscription")
  @HttpCode(HttpStatus.OK)
  createSubscription(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.service.createSubscription(req.user.id, id, dto);
  }

  @Post(":id/subscription/extend")
  @HttpCode(HttpStatus.OK)
  extendSubscription(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: ExtendSubscriptionDto,
  ) {
    return this.service.extendSubscription(req.user.id, id, dto);
  }

  @Post(":id/suspend")
  @HttpCode(HttpStatus.OK)
  suspend(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: SuspendCustomerDto,
  ) {
    return this.service.suspend(req.user.id, id, dto);
  }

  @Post(":id/unsuspend")
  @HttpCode(HttpStatus.OK)
  unsuspend(@Request() req: AuthReq, @Param("id") id: string) {
    return this.service.unsuspend(req.user.id, id);
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.OK)
  softDelete(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: DeleteCustomerDto,
  ) {
    return this.service.softDelete(req.user.id, id, dto);
  }
}
