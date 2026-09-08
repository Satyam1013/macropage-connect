import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { TeamService } from "./team.service";
import { ActivityService } from "../users/activity.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { UserRole } from "../auth/auth.constants";

@Controller("projects/:projectId/team")
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class TeamProjectController {
  constructor(
    private readonly teamService: TeamService,
    private readonly activityService: ActivityService,
  ) {}

  // ── Static GET routes (must come before /:id) ─────────────────────────────

  @Get()
  findAll(@Request() req: ProjectAuthReq, @Query("search") search?: string) {
    return this.teamService.findAll(req.projectId, search);
  }

  @Get("activity")
  getMemberActivity(
    @Request() req: ProjectAuthReq,
    @Query("memberId") memberId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
  ) {
    if (!memberId) throw new BadRequestException("memberId is required");
    return this.activityService.getUserActivity(
      req.projectId,
      memberId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      type,
    );
  }

  @Get("assignable")
  getAssignableMembers(@Request() req: ProjectAuthReq) {
    return this.teamService.getAssignableMembers(req.projectId);
  }

  @Get("invites")
  getInvites(@Request() req: ProjectAuthReq) {
    return this.teamService.getInvites(req.projectId);
  }

  // ── Dynamic /:id route (must come after all static routes) ────────────────

  @Get(":id")
  findOne(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.teamService.findOne(req.projectId, id);
  }

  // ── Invite actions ────────────────────────────────────────────────────────

  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Request() req: ProjectAuthReq,
    @Body()
    body: {
      emails: string[];
      role: UserRole;
      message?: string;
      expiresIn?: string;
    },
  ) {
    return this.teamService.invite(
      req.projectId,
      req.user.id,
      req.user.name,
      body.emails,
      body.role,
      body.message,
      body.expiresIn,
    );
  }

  @Post("invite/:id/resend")
  @HttpCode(HttpStatus.OK)
  resendInvite(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.teamService.resendInvite(req.projectId, id, req.user.name);
  }

  @Delete("invite/:id")
  @HttpCode(HttpStatus.OK)
  cancelInviteById(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.teamService.cancelInvite(req.projectId, id);
  }

  @Delete("invites/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvite(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.teamService.cancelInvite(req.projectId, id);
  }

  // ── Member actions ────────────────────────────────────────────────────────

  @Patch(":id/role")
  changeRole(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body("role") role: UserRole,
  ) {
    return this.teamService.changeRole(req.projectId, id, role, req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    return this.teamService.deactivate(req.projectId, id, req.user.id);
  }
}

@Controller("team")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // PUBLIC — no auth (invitee has no account yet)
  @Get("invite/verify/:token")
  verifyInviteToken(@Param("token") token: string) {
    return this.teamService.verifyInviteToken(token);
  }

  // PUBLIC — no auth (invitee has no account yet)
  @Post("invite/accept")
  @HttpCode(HttpStatus.CREATED)
  acceptInvite(
    @Body() body: { token: string; name: string; password: string },
  ) {
    return this.teamService.acceptInvite(body);
  }
}
