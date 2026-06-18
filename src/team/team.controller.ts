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
} from "@nestjs/common";
import { TeamService } from "./team.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";
import { UserRole } from "../auth/dto/signup.dto";

@Controller("team")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @UseGuards(JwtAuthGuard)
  @Get("assignable")
  getAssignableMembers(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.getAssignableMembers(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  findOne(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.findOne(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: AuthReq, @Query("search") search?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.findAll(tenantId, search);
  }

  @UseGuards(JwtAuthGuard)
  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Request() req: AuthReq,
    @Body()
    body: {
      emails: string[];
      role: UserRole;
      message?: string;
      expiresIn?: string;
    },
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.invite(
      tenantId,
      req.user.id,
      req.user.name,
      body.emails,
      body.role,
      body.message,
      body.expiresIn,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("invites")
  getInvites(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.getInvites(tenantId);
  }

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

  @UseGuards(JwtAuthGuard)
  @Post("invite/:id/resend")
  @HttpCode(HttpStatus.OK)
  resendInvite(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.resendInvite(tenantId, id, req.user.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("invite/:id")
  @HttpCode(HttpStatus.OK)
  cancelInviteById(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.cancelInvite(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("invites/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvite(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.cancelInvite(tenantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/role")
  changeRole(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body("role") role: UserRole,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.changeRole(tenantId, id, role, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.deactivate(tenantId, id, req.user.id);
  }
}
