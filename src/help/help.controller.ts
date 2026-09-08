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
import { HelpService } from "./help.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { CreateVideoTutorialDto } from "./dto/create-video-tutorial.dto";
import { UpdateVideoTutorialDto } from "./dto/update-video-tutorial.dto";
import { CreateDocDto } from "./dto/create-doc.dto";
import { UpdateDocDto } from "./dto/update-doc.dto";
import { CreateFaqDto } from "./dto/create-faq.dto";
import { UpdateFaqDto } from "./dto/update-faq.dto";
import { QueryTicketsDto } from "./dto/query-tickets.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";

@Controller("projects/:projectId/help")
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class HelpProjectController {
  constructor(private readonly helpService: HelpService) {}

  @Post("tickets")
  @HttpCode(HttpStatus.CREATED)
  createTicket(@Request() req: ProjectAuthReq, @Body() dto: CreateTicketDto) {
    return this.helpService.createTicket(
      req.projectId,
      { id: req.user.id, name: req.user.name, email: req.user.email },
      dto,
    );
  }

  @Get("tickets")
  async getTickets(
    @Request() req: ProjectAuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const {
      data,
      total,
      page: p,
      limit: l,
    } = await this.helpService.listTickets(
      req.projectId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
    return { success: true, data, total, page: p, limit: l };
  }

  @Get("tickets/:id")
  async getTicket(@Request() req: ProjectAuthReq, @Param("id") id: string) {
    const data = await this.helpService.getTicketById(req.projectId, id);
    return { success: true, data };
  }

  @Get("status")
  getStatus(
    @Request() req: ProjectAuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.helpService.getSystemStatus(
      req.projectId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}

@Controller("help")
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get("tickets/platform")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  async findAllTicketsForPlatform(@Query() query: QueryTicketsDto) {
    const { data, total, page, limit } =
      await this.helpService.findAllTicketsForPlatform(query);
    return { success: true, data, total, page, limit };
  }

  @Get("tickets/platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  async findOneTicketForPlatform(@Param("id") id: string) {
    const data = await this.helpService.findOneTicketForPlatform(id);
    return { success: true, data };
  }

  @Patch("tickets/platform/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN, PlatformRole.SUPPORT_AGENT)
  updateTicketStatus(@Param("id") id: string, @Body() dto: UpdateTicketDto) {
    return this.helpService.updateTicketStatus(id, dto);
  }

  @Get("docs")
  getDocs(@Query("category") category?: string) {
    return this.helpService.getDocs(category);
  }

  @Get("faq")
  getFaqs(@Query("category") category?: string) {
    return this.helpService.getFaqs(category);
  }

  @Post("platform/docs")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  createDoc(@Body() dto: CreateDocDto) {
    return this.helpService.createDoc(dto);
  }

  @Patch("platform/docs/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  updateDoc(@Param("id") id: string, @Body() dto: UpdateDocDto) {
    return this.helpService.updateDoc(id, dto);
  }

  @Delete("platform/docs/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  deleteDoc(@Param("id") id: string) {
    return this.helpService.deleteDoc(id);
  }

  @Post("platform/faq")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  createFaq(@Body() dto: CreateFaqDto) {
    return this.helpService.createFaq(dto);
  }

  @Patch("platform/faq/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  updateFaq(@Param("id") id: string, @Body() dto: UpdateFaqDto) {
    return this.helpService.updateFaq(id, dto);
  }

  @Delete("platform/faq/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  deleteFaq(@Param("id") id: string) {
    return this.helpService.deleteFaq(id);
  }

  @Get("videos")
  getVideoTutorials() {
    return this.helpService.getVideoTutorials();
  }

  @Post("platform/video-tutorials")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  createVideoTutorial(@Body() dto: CreateVideoTutorialDto) {
    return this.helpService.createVideoTutorial(dto);
  }

  @Patch("platform/video-tutorials/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  updateVideoTutorial(
    @Param("id") id: string,
    @Body() dto: UpdateVideoTutorialDto,
  ) {
    return this.helpService.updateVideoTutorial(id, dto);
  }

  @Delete("platform/video-tutorials/:id")
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  deleteVideoTutorial(@Param("id") id: string) {
    return this.helpService.deleteVideoTutorial(id);
  }

  @Get("search")
  search(@Query("q") q: string) {
    return this.helpService.search(q);
  }

  // Remove this endpoint after running once
  @Post("reseed")
  @HttpCode(HttpStatus.OK)
  async reseed() {
    const counts = await this.helpService.seedData(true);
    return { success: true, ...counts };
  }
}
