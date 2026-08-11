import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import type { UserDocument } from "../../users/users.service";

// Routes reachable on a "pending project selection" session — i.e. before
// POST /auth/select-project is called (see AuthService.login/selectProject).
// Every other JwtAuthGuard-protected route across the app is blocked until
// then: this app has no @TenantId() decorator, every controller resolves
// tenant via `req.user.tenantId ?? req.user.id`, which would otherwise let
// an owner silently reach their own project's data without ever selecting
// it — the JWT itself carries no tenantId, so this can't be caught upstream.
const PROJECT_SELECTION_EXEMPT_PREFIXES = [
  "/api/v1/auth/my-projects",
  "/api/v1/auth/select-project",
  "/api/v1/auth/create-project",
  "/api/v1/auth/me",
  "/api/v1/auth/sessions",
];

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = (await super.canActivate(context)) as boolean;
    if (!activated) return false;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as UserDocument | undefined;
    if (!user?.pendingAccountSelection) return true;

    if (PROJECT_SELECTION_EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
      return true;
    }

    throw new ForbiddenException({
      code: "PROJECT_SELECTION_REQUIRED",
      message: "Select a project before continuing.",
    });
  }
}
