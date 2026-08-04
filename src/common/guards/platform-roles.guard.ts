import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PLATFORM_ROLES_KEY } from "../decorators/platform-roles.decorator";
import { PlatformRole } from "../../auth/auth.constants";

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { platformRole?: string };
    }>();
    const platformRole = request.user?.platformRole;

    if (!platformRole) {
      throw new ForbiddenException("No platform role assigned");
    }
    if (!requiredRoles.includes(platformRole as PlatformRole)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `This action requires one of: ${requiredRoles.join(", ")}`,
      });
    }
    return true;
  }
}
