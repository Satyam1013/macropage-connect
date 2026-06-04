import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string } };

@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // API Keys
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

  // Webhooks
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
}
