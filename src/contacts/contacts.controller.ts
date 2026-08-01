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
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import { AssignSegmentContactsDto } from "./dto/assign-segment-contacts.dto";
import { ImportContactsDto } from "./dto/import-contacts.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserPayload } from "../auth/dto/auth-response.interface";

@UseGuards(JwtAuthGuard)
@Controller("contacts")
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get("segments")
  getSegments(@Request() req: { user: UserPayload & { tenantId?: string } }) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.getSegments(tenantId);
  }

  @Post("segments")
  @HttpCode(HttpStatus.CREATED)
  createSegment(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Body() dto: CreateSegmentDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.createSegment(tenantId, dto);
  }

  @Patch("segments/:id")
  @HttpCode(HttpStatus.OK)
  assignSegmentContacts(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Param("id") id: string,
    @Body() dto: AssignSegmentContactsDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.assignContactsToSegment(
      tenantId,
      id,
      dto.contactIds,
    );
  }

  @Get("segments/:id/contacts")
  getSegmentContacts(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Param("id") id: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.getSegmentContacts(tenantId, id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post("import")
  @HttpCode(HttpStatus.OK)
  importContacts(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Body() dto: ImportContactsDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.importContacts(
      tenantId,
      dto.fileUrl,
      dto.columnMapping,
      dto.duplicateHandling,
    );
  }

  @Get("tags")
  getTags(@Request() req: { user: UserPayload & { tenantId?: string } }) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.getTags(tenantId);
  }

  @Get()
  findAll(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Query("search") search?: string,
    @Query("tags") tags?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.findAll(tenantId, {
      search,
      tags: tags ? tags.split(",") : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(":id")
  findOne(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Param("id") id: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.getDetails(tenantId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Body() dto: CreateContactDto,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.create(tenantId, dto);
  }

  @Patch(":id")
  update(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Param("id") id: string,
    @Body() dto: Partial<CreateContactDto>,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.update(tenantId, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Param("id") id: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.remove(tenantId, id);
  }

  @Post("bulk-delete")
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Body() body: { ids: string[] },
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.bulkDelete(tenantId, body.ids);
  }

  @Post("bulk-tag")
  @HttpCode(HttpStatus.OK)
  bulkTag(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @Body() body: { ids: string[]; tags: string[]; action: "add" | "remove" },
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.bulkTag(
      tenantId,
      body.ids,
      body.tags,
      body.action,
    );
  }
}
