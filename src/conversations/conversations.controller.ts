import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Header,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import {
  SendMessageDto,
  AddNoteDto,
  UpdateConversationDto,
} from "./dto/send-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/dto/signup.dto";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post("initiate")
  @HttpCode(HttpStatus.CREATED)
  initiate(
    @Request() req: AuthReq,
    @Body() body: { contactId: string; templateName?: string },
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.initiateConversation(
      tenantId,
      body.contactId,
      body.templateName ?? "hello_world",
      req.user.id,
    );
  }

  @Get()
  findAll(
    @Request() req: AuthReq,
    @Query("status") status?: string,
    @Query("assignedTo") assignedTo?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.findAll(
      tenantId,
      req.user.id,
      req.user.role ?? "AGENT",
      {
        status,
        assignedTo,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      },
    );
  }

  @Get(":id")
  findOne(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.findOne(
      tenantId,
      id,
      req.user.id,
      req.user.role ?? "AGENT",
    );
  }

  @Get(":id/messages")
  @Header("Cache-Control", "no-cache, no-store, must-revalidate")
  @Header("Pragma", "no-cache")
  getMessages(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Query("page") page?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.getMessages(
      tenantId,
      id,
      page ? Number(page) : 1,
    );
  }

  @Post(":id/messages")
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.sendMessage(
      tenantId,
      id,
      dto,
      req.user.id,
    );
  }

  @Post(":id/notes")
  @HttpCode(HttpStatus.CREATED)
  addNote(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: AddNoteDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.addNote(tenantId, id, dto, req.user.id);
  }

  @Patch(":id")
  update(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.updateConversation(tenantId, id, dto);
  }

  @Patch(":id/resolve")
  resolve(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.resolveConversation(tenantId, id);
  }

  @Put(":id/assign")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  assignConversation(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body("assignToUserId") assignToUserId: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.assignConversation(
      tenantId,
      id,
      req.user.id,
      req.user.name,
      assignToUserId,
    );
  }

  @Delete(":id/assign")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  unassignConversation(@Request() req: AuthReq, @Param("id") id: string) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.conversationsService.unassignConversation(tenantId, id);
  }
}
