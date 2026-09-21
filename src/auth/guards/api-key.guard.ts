import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { SettingsService } from "../../settings/settings.service";
import { API_PERMISSION_KEY } from "../../common/decorators/require-permission.decorator";
import { hasApiPermission } from "../../common/api-key-permissions";

export interface ApiKeyContext {
  tenantId: string;
  keyId: string;
  name: string;
  permissions: string[];
}

export type ApiKeyRequest = Request & { apiKey: ApiKeyContext };

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ApiKeyRequest>();
    const rawKey = req.header("x-api-key");

    if (!rawKey) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "API_KEY_REQUIRED",
          message: "Provide an API key in the X-API-Key header.",
        },
      });
    }

    const record = await this.settingsService.validateApiKey(rawKey, req.ip);
    if (!record) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: "API_KEY_INVALID",
          message: "Invalid, expired, or revoked API key.",
        },
      });
    }

    const requiredPermission = this.reflector.getAllAndOverride<
      string | undefined
    >(API_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (
      requiredPermission &&
      !hasApiPermission(record.permissions, requiredPermission)
    ) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: "API_KEY_MISSING_PERMISSION",
          message: `This API key does not have the "${requiredPermission}" permission.`,
        },
      });
    }

    req.apiKey = {
      tenantId: record.tenantId,
      keyId: String(record._id),
      name: record.name,
      permissions: record.permissions,
    };

    return true;
  }
}
