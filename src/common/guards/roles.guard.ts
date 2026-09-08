import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRole } from "../../auth/auth.constants";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
      projectRole?: string;
    }>();
    // projectRole (set by ProjectAccessGuard, which must run first) reflects
    // the caller's role on THIS URL's :projectId — request.user.role only
    // reflects whichever project was last selected via the legacy
    // session-based flow and is stale/wrong once routes are project-scoped.
    const userRole = request.projectRole ?? request.user?.role;

    if (!userRole) {
      throw new ForbiddenException("No role assigned");
    }
    if (!requiredRoles.includes(userRole as UserRole)) {
      throw new ForbiddenException({
        code: "INSUFFICIENT_PERMISSIONS",
        message: `This action requires one of: ${requiredRoles.join(", ")}`,
      });
    }
    return true;
  }
}
