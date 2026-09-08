import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { QuickRepliesService } from "./quick-replies.service";
import { CreateQuickReplyDto } from "./dto/create-quick-reply.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/quick-replies")
export class QuickRepliesController {
  constructor(private readonly service: QuickRepliesService) {}

  @Get()
  findAll(@Request() req: ProjectAuthReq, @Query("search") search?: string) {
    const tenantId = req.projectId;
    return this.service.findAll(tenantId, search);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: ProjectAuthReq, @Body() dto: CreateQuickReplyDto) {
    const tenantId = req.projectId;
    return this.service.create(tenantId, req.user.id, dto);
  }

  @Put(":id")
  update(
    @Request() req: ProjectAuthReq,
    @Param("id") id: string,
    @Body() dto: Partial<CreateQuickReplyDto>,
  ) {
    const tenantId = req.projectId;
    return this.service.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const tenantId = req.projectId;
    return this.service.remove(tenantId, id);
  }
}
