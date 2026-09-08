import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { Request } from "express";
import {
  UserAccountMembership,
  UserAccountMembershipDocument,
} from "../../auth/schemas/user-account-membership.schema";

export interface ProjectScopedRequest extends Request {
  user: { id: string; [key: string]: unknown };
  projectId: string;
  projectRole: string;
  params: Request["params"] & { projectId: string };
}

// Every project-scoped route (POST/GET .../projects/:projectId/...) goes
// through this guard: it verifies the caller actually has an active
// UserAccountMembership for :projectId, then attaches projectId/projectRole
// to the request. RolesGuard reads projectRole (not request.user.role,
// which reflects whichever project was last selected via the legacy
// session-based flow) — this guard must run BEFORE RolesGuard in
// @UseGuards(). Without this, a URL-based projectId is just an unverified
// client-supplied string — anyone could put any tenant's id in the path.
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    @InjectModel(UserAccountMembership.name)
    private readonly membershipModel: Model<UserAccountMembershipDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ProjectScopedRequest>();
    const projectId = req.params?.projectId;
    if (!projectId) {
      throw new ForbiddenException({
        code: "PROJECT_ID_REQUIRED",
        message: "This route requires a project in the URL.",
      });
    }

    const membership = await this.membershipModel
      .findOne({ userId: req.user.id, tenantId: projectId, isActive: true })
      .lean()
      .exec();
    if (!membership) {
      throw new ForbiddenException({
        code: "NOT_A_PROJECT_MEMBER",
        message: "You do not have access to this project.",
      });
    }

    req.projectId = projectId;
    req.projectRole = membership.role;
    return true;
  }
}
