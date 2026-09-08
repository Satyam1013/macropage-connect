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
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Account / Company settings ────────────────────────────────────────────

  @Get("account")
  getAccount(@Request() req: ProjectAuthReq) {
    return this.settingsService.getAccount(req.projectId);
  }

  @Patch("account")
  updateAccount(
    @Request() req: ProjectAuthReq,
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
    return this.settingsService.updateAccount(req.projectId, dto);
  }

  @Post("account/logo")
  @UseInterceptors(FileInterceptor("file"))
  uploadLogo(
    @Request() req: ProjectAuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.settingsService.uploadLogo(req.projectId, file);
  }

  // ── User profile ──────────────────────────────────────────────────────────

  @Get("profile")
  getProfile(@Request() req: ProjectAuthReq) {
    return this.settingsService.getProfile(req.user.id);
  }

  @Patch("profile")
  updateProfile(
    @Request() req: ProjectAuthReq,
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
  getNotifications(@Request() req: ProjectAuthReq) {
    return this.settingsService.getNotificationPrefs(req.user.id);
  }

  @Put("notifications")
  updateNotifications(
    @Request() req: ProjectAuthReq,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.settingsService.updateNotificationPrefs(req.user.id, dto);
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  @Get("api-keys")
  @UseGuards(PlanGuard)
  @RequirePlan("apiAccess")
  listApiKeys(@Request() req: ProjectAuthReq) {
    return this.settingsService.listApiKeys(req.projectId);
  }

  @Post("api-keys")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(PlanGuard)
  @RequirePlan("apiAccess")
  createApiKey(
    @Request() req: ProjectAuthReq,
    @Body() body: { name: string; permissions: string[] },
  ) {
    return this.settingsService.createApiKey(
      req.projectId,
      body.name,
      body.permissions,
    );
  }

  @Delete("api-keys/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeApiKey(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.settingsService.revokeApiKey(req.projectId, id);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  @Get("webhooks")
  listWebhooks(@Request() req: ProjectAuthReq) {
    return this.settingsService.listWebhooks(req.projectId);
  }

  @Post("webhooks")
  @HttpCode(HttpStatus.CREATED)
  createWebhook(
    @Request() req: ProjectAuthReq,
    @Body() body: { url: string; events: string[]; description?: string },
  ) {
    return this.settingsService.createWebhook(
      req.projectId,
      body.url,
      body.events,
      body.description,
    );
  }

  @Patch("webhooks/:id")
  updateWebhook(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: { url?: string; events?: string[]; isEnabled?: boolean },
  ) {
    return this.settingsService.updateWebhook(req.projectId, id, dto);
  }

  @Delete("webhooks/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWebhook(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.settingsService.deleteWebhook(req.projectId, id);
  }

  @Post("webhooks/:id/test")
  testWebhook(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.settingsService.testWebhook(req.projectId, id);
  }
}
