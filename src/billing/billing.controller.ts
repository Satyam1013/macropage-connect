import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  UseGuards,
  Request,
  Req,
} from "@nestjs/common";
import { BillingService } from "./billing.service";
import { RazorpayService } from "./razorpay.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { UserRole, PlatformRole } from "../auth/auth.constants";
import type { AuthReq } from "../auth/dto/auth-request.interface";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";
import { TenantResolverService } from "../tenant/tenant-resolver.service";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly razorpayService: RazorpayService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  // ── Public ─────────────────────────────────────────────────────────────────

  @Get("plans")
  getPlans() {
    return this.billingService.getPlans();
  }

  // ── Platform-staff ─────────────────────────────────────────────────────────

  @Patch("platform/plans/:planId")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  updatePlan(@Param("planId") planId: string, @Body() dto: UpdatePlanDto) {
    return this.billingService.updatePlanCatalog(planId, dto);
  }

  @Get("platform/plans/customer/:tenantId")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  getPlanHistoryForCustomer(@Param("tenantId") tenantId: string) {
    return this.billingService.getPlanHistoryForPlatform(tenantId);
  }

  @Get("platform/plans/customer/:tenantId/current")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  getCurrentSubscriptionForCustomer(@Param("tenantId") tenantId: string) {
    return this.billingService.getSubscription(tenantId);
  }

  // ── Owner-only ─────────────────────────────────────────────────────────────

  // Billing lives on a person's own MAIN account only — sub accounts
  // created via POST /auth/create-account share it rather than carrying
  // an independent plan (see TenantResolverService.resolveBillingTenantId).
  private resolveBillingTenantId(req: AuthReq): Promise<string> {
    return this.tenantResolver.resolveBillingTenantId(
      req.user.id,
      req.user.tenantId ?? req.user.id,
    );
  }

  @Get("subscription")
  @UseGuards(JwtAuthGuard)
  async getSubscription(@Request() req: AuthReq) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.getOrCreateSubscription(tenantId);
  }

  @Post("subscription")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async createSubscription(
    @Request() req: AuthReq,
    @Body() dto: CreateSubscriptionDto,
  ) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.createRazorpaySubscription(
      tenantId,
      req.user.id,
      dto.plan,
      dto.billingCycle,
    );
  }

  @Post("verify-payment")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async verifyPayment(@Request() req: AuthReq, @Body() dto: VerifyPaymentDto) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.verifyPayment(tenantId, req.user.id, dto);
  }

  @Delete("subscription")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async cancelSubscription(
    @Request() req: AuthReq,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.cancelSubscription(
      tenantId,
      req.user.id,
      dto.cancelImmediately ?? false,
    );
  }

  @Get("payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async getPaymentHistory(
    @Request() req: AuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.getPaymentHistory(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get("invoices")
  @UseGuards(JwtAuthGuard)
  async getInvoices(@Request() req: AuthReq) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.getInvoices(tenantId);
  }

  @Get("payment-method")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  async getPaymentMethod(@Request() req: AuthReq) {
    const tenantId = await this.resolveBillingTenantId(req);
    return this.billingService.getPaymentMethod(tenantId);
  }

  // ── Webhook (PUBLIC — Razorpay calls this directly) ────────────────────────

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers("x-razorpay-signature") signature: string,
    @Req() req: Request & { rawBody?: string },
    @Body() body: { event: string; payload: unknown },
  ) {
    const rawBody = req.rawBody ?? JSON.stringify(body);

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException("Webhook secret not configured");

    const isValid = this.razorpayService.verifyWebhookSignature(
      rawBody,
      signature,
      secret,
    );
    if (!isValid) throw new BadRequestException("Invalid webhook signature");

    await this.billingService.handleWebhook(body.event, body.payload);
    return { status: "ok" };
  }
}
