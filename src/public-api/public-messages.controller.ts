import {
  Controller,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import type { ApiKeyRequest } from "../auth/guards/api-key.guard";
import { RequirePermission } from "../common/decorators/require-permission.decorator";
import { ContactsService } from "../contacts/contacts.service";
import { ConversationsService } from "../conversations/conversations.service";
import { SendPublicMessageDto } from "./dto/send-public-message.dto";

@Controller("public/messages")
export class PublicMessagesController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
  ) {}

  @Post("send")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @RequirePermission("messages:send")
  async send(@Request() req: ApiKeyRequest, @Body() dto: SendPublicMessageDto) {
    const { tenantId } = req.apiKey;
    const contact = await this.contactsService.findOrCreate(
      tenantId,
      dto.phone,
      dto.name,
    );
    return this.conversationsService.initiateConversation(
      tenantId,
      String(contact._id),
      dto.templateName,
      undefined,
      dto.templateVars,
    );
  }
}
