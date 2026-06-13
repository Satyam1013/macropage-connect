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
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("templates")
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query("status") status?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.findAll(tenantId, status);
  }

  @Get("sync")
  sync(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.syncFromMeta(tenantId);
  }

  @Get(":id")
  findOne(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.findOne(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: CreateTemplateDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.create(tenantId, dto);
  }

  @Post("draft")
  @HttpCode(HttpStatus.CREATED)
  saveDraft(@Request() req: AuthReq, @Body() dto: CreateTemplateDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.saveDraft(tenantId, dto);
  }

  @Patch(":id/draft")
  @HttpCode(HttpStatus.OK)
  updateDraft(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: Partial<CreateTemplateDto>,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.updateDraft(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.templatesService.remove(tenantId, id);
  }
}
