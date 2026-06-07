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
import { ConversationsService } from "./conversations.service";
import {
  SendMessageDto,
  AddNoteDto,
  UpdateConversationDto,
} from "./dto/send-message.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserPayload } from "../auth/dto/auth-response.interface";

type AuthReq = { user: UserPayload & { tenantId?: string; role?: string } };

@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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
}
