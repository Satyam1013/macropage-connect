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
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("quick-replies")
export class QuickRepliesController {
  constructor(private readonly service: QuickRepliesService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query("search") search?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.findAll(tenantId, search);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: CreateQuickReplyDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.create(tenantId, req.user.id, dto);
  }

  @Put(":id")
  update(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: Partial<CreateQuickReplyDto>,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.service.remove(tenantId, id);
  }
}
