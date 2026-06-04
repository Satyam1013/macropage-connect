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
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string } };

@UseGuards(JwtAuthGuard)
@Controller("team")
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query("search") search?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.findAll(tenantId, search);
  }

  @Post("invite")
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Request() req: AuthReq,
    @Body() body: { email: string; role: string },
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.invite(
      tenantId,
      req.user.id,
      body.email,
      body.role,
    );
  }

  @Get("invites")
  getInvites(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.getInvites(tenantId);
  }

  @Delete("invites/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelInvite(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.cancelInvite(tenantId, id);
  }

  @Patch(":id/role")
  changeRole(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body("role") role: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.changeRole(tenantId, id, role, req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deactivate(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.teamService.deactivate(tenantId, id, req.user.id);
  }
}
