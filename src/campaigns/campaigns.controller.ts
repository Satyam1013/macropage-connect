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
import type { AuthReq } from "../auth/dto/auth-request.interface";


@UseGuards(JwtAuthGuard)
@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Request() req: AuthReq, @Query("status") status?: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.findAll(tenantId, status);
  }

  @Get(":id")
  findOne(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.findOne(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: Record<string, unknown>) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.create(tenantId, req.user.id, dto);
  }

  @Post(":id/launch")
  launch(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.launch(tenantId, id);
  }

  @Patch(":id/pause")
  pause(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.pause(tenantId, id);
  }

  @Patch(":id/cancel")
  cancel(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.cancel(tenantId, id);
  }

  @Get(":id/recipients")
  getRecipients(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Query("page") page?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.campaignsService.getRecipients(
      tenantId,
      id,
      page ? Number(page) : 1,
    );
  }
}
