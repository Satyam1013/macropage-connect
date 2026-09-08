import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Request() req: ProjectAuthReq, @Query("status") status?: string) {
    const tenantId = req.projectId;
    return this.campaignsService.findAll(tenantId, status);
  }

  @Get("templates")
  getTemplates(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.campaignsService.getTemplates(tenantId);
  }

  @Get(":id")
  findOne(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.campaignsService.findOne(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: ProjectAuthReq, @Body() dto: Record<string, unknown>) {
    const tenantId = req.projectId;
    return this.campaignsService.create(tenantId, req.user.id, dto);
  }

  @Post(":id/launch")
  launch(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.campaignsService.launch(tenantId, id);
  }

  @Post(":id/retry")
  retry(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.campaignsService.retry(tenantId, id);
  }

  @Patch(":id/pause")
  pause(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.campaignsService.pause(tenantId, id);
  }

  @Patch(":id/cancel")
  cancel(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.campaignsService.cancel(tenantId, id);
  }

  @Get(":id/recipients")
  getRecipients(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Query("page") page?: string,
  ) {
    const tenantId = req.projectId;
    return this.campaignsService.getRecipients(
      tenantId,
      id,
      page ? Number(page) : 1,
    );
  }
}
