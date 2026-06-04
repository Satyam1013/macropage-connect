import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { BillingService } from "./billing.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string } };

@Controller("billing")
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("plans")
  getPlans() {
    return this.billingService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get("subscription")
  getSubscription(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.getOrCreateSubscription(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get("invoices")
  getInvoices(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.getInvoices(tenantId);
  }
}
