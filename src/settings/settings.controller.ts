import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Account / Company settings ────────────────────────────────────────────

  @Get("account")
  getAccount(@Request() req: AuthReq) {
    return this.settingsService.getAccount(req.user.tenantId ?? req.user.id);
  }

  @Patch("account")
  updateAccount(
    @Request() req: AuthReq,
    @Body()
    dto: {
      companyName?: string;
      website?: string;
      description?: string;
      industry?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      timezone?: string;
      language?: string;
      currency?: string;
    },
  ) {
    return this.settingsService.updateAccount(
      req.user.tenantId ?? req.user.id,
      dto,
    );
  }

  @Post("account/logo")
  @UseInterceptors(FileInterceptor("file"))
  uploadLogo(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.settingsService.uploadLogo(
      req.user.tenantId ?? req.user.id,
      file,
    );
  }

  // ── User profile ──────────────────────────────────────────────────────────

  @Get("profile")
  getProfile(@Request() req: AuthReq) {
    return this.settingsService.getProfile(req.user.id);
  }

  @Patch("profile")
  updateProfile(
    @Request() req: AuthReq,
    @Body()
    dto: {
      name?: string;
      phone?: string;
      department?: string;
      jobTitle?: string;
      timezone?: string;
      language?: string;
    },
  ) {
    return this.settingsService.updateProfile(req.user.id, dto);
  }

  // ── Notification preferences ──────────────────────────────────────────────

  @Get("notifications")
  getNotifications(@Request() req: AuthReq) {
    return this.settingsService.getNotificationPrefs(req.user.id);
  }

  @Put("notifications")
  updateNotifications(
    @Request() req: AuthReq,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.settingsService.updateNotificationPrefs(req.user.id, dto);
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  @Get("api-keys")
  listApiKeys(@Request() req: AuthReq) {
    return this.settingsService.listApiKeys(req.user.tenantId ?? req.user.id);
  }

  @Post("api-keys")
  @HttpCode(HttpStatus.CREATED)
  createApiKey(
    @Request() req: AuthReq,
    @Body() body: { name: string; permissions: string[] },
  ) {
    return this.settingsService.createApiKey(
      req.user.tenantId ?? req.user.id,
      body.name,
      body.permissions,
    );
  }

  @Delete("api-keys/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeApiKey(@Request() req: AuthReq, @Param("id") id: string) {
    return this.settingsService.revokeApiKey(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @Get("webhooks")
  listWebhooks(@Request() req: AuthReq) {
    return this.settingsService.listWebhooks(req.user.tenantId ?? req.user.id);
  }

  @Post("webhooks")
  @HttpCode(HttpStatus.CREATED)
  createWebhook(
    @Request() req: AuthReq,
    @Body() body: { url: string; events: string[]; description?: string },
  ) {
    return this.settingsService.createWebhook(
      req.user.tenantId ?? req.user.id,
      body.url,
      body.events,
      body.description,
    );
  }

  @Patch("webhooks/:id")
  updateWebhook(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: { url?: string; events?: string[]; isEnabled?: boolean },
  ) {
    return this.settingsService.updateWebhook(
      req.user.tenantId ?? req.user.id,
      id,
      dto,
    );
  }

  @Delete("webhooks/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebhook(@Request() req: AuthReq, @Param("id") id: string) {
    return this.settingsService.deleteWebhook(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  @Post("webhooks/:id/test")
  testWebhook(@Request() req: AuthReq, @Param("id") id: string) {
    return this.settingsService.testWebhook(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }
}
