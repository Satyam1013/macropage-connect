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
import { TemplatesService } from "./templates.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/templates")
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(@Request() req: ProjectAuthReq, @Query("status") status?: string) {
    const tenantId = req.projectId;
    return this.templatesService.findAll(tenantId, status);
  }

  @Get("sync")
  sync(@Request() req: ProjectAuthReq) {
    const tenantId = req.projectId;
    return this.templatesService.syncFromMeta(tenantId);
  }

  @Get(":id")
  findOne(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.templatesService.findOne(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: ProjectAuthReq, @Body() dto: CreateTemplateDto) {
    const tenantId = req.projectId;
    return this.templatesService.create(tenantId, dto);
  }

  @Post("draft")
  @HttpCode(HttpStatus.CREATED)
  saveDraft(@Request() req: ProjectAuthReq, @Body() dto: CreateTemplateDto) {
    const tenantId = req.projectId;
    return this.templatesService.saveDraft(tenantId, dto);
  }

  @Patch(":id/draft")
  @HttpCode(HttpStatus.OK)
  updateDraft(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    const tenantId = req.projectId;
    return this.templatesService.updateDraft(tenantId, id, dto);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  update(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    const tenantId = req.projectId;
    return this.templatesService.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.templatesService.remove(tenantId, id);
  }
}
