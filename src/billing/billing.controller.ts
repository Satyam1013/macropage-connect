import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
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
import { UserRole } from "../auth/dto/signup.dto";
import type { AuthReq } from "../auth/dto/auth-request.interface";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { VerifyPaymentDto } from "./dto/verify-payment.dto";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";

@Controller("billing")
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly razorpayService: RazorpayService,
  ) {}

  // ── Public ─────────────────────────────────────────────────────────────────

  @Get("plans")
  getPlans() {
    return this.billingService.getPlans();
  }

  // ── Owner-only ─────────────────────────────────────────────────────────────

  @Get("subscription")
  @UseGuards(JwtAuthGuard)
  getSubscription(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.getOrCreateSubscription(tenantId);
  }

  @Post("subscription")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  createSubscription(@Request() req: AuthReq, @Body() dto: CreateSubscriptionDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
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
  verifyPayment(@Request() req: AuthReq, @Body() dto: VerifyPaymentDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.verifyPayment(tenantId, req.user.id, dto);
  }

  @Delete("subscription")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  cancelSubscription(
    @Request() req: AuthReq,
    @Body() dto: CancelSubscriptionDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.cancelSubscription(
      tenantId,
      req.user.id,
      dto.cancelImmediately ?? false,
    );
  }

  @Get("payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER)
  getPaymentHistory(
    @Request() req: AuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.getPaymentHistory(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get("invoices")
  @UseGuards(JwtAuthGuard)
  getInvoices(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.billingService.getInvoices(tenantId);
  }

  // ── Webhook (PUBLIC — Razorpay calls this directly) ────────────────────────

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers("x-razorpay-signature") signature: string,
    @Req() req: Request & { rawBody?: string },
    @Body() body: { event: string; payload: unknown },
  ) {
    const rawBody =
      req.rawBody ?? JSON.stringify(body);

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
