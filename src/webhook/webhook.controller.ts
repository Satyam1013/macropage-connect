import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from "@nestjs/common";
import { WebhookService } from "./webhook.service";
import { BillingService } from "../billing/billing.service";
import type { Response } from "express";

@Controller("webhook")
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
    private readonly billingService: BillingService,
  ) {}

  @Get("meta")
  verifyMeta(@Query() query: Record<string, string>, @Res() res: Response) {
    try {
      const challenge = this.webhookService.verifyWebhook(query);
      res.status(200).send(challenge);
    } catch {
      res.status(403).send("Forbidden");
    }
  }

  @Post("meta")
  @HttpCode(HttpStatus.OK)
  handleMeta(@Body() body: Record<string, unknown>) {
    void this.webhookService.handleMetaWebhook(body);
    return { status: "ok" };
  }

  @Post("razorpay")
  @HttpCode(HttpStatus.OK)
  async handleRazorpay(
    @Req() req: { rawBody?: Buffer },
    @Headers("x-razorpay-signature") signature: string,
    @Body() body: { event: string; payload: unknown },
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(body);
    const valid = this.webhookService.verifyRazorpaySignature(
      rawBody,
      signature,
    );
    if (!valid) return { status: "ignored" };
    await this.billingService.handleWebhook(body.event, body.payload);
    return { status: "ok" };
  }
}
