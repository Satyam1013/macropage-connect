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
  UseInterceptors,
  UploadedFile,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import { AssignSegmentContactsDto } from "./dto/assign-segment-contacts.dto";
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

  @Post("import")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  importContacts(
    @Request() req: { user: UserPayload & { tenantId?: string } },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const isExcel =
      file.mimetype.includes("spreadsheetml") ||
      file.originalname.toLowerCase().endsWith(".xlsx");
    if (!isExcel) {
      throw new BadRequestException("Only .xlsx files are supported");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("File must be under 5MB");
    }

    const tenantId = req.user.tenantId ?? req.user.id;
    return this.contactsService.importFromExcel(tenantId, file.buffer);
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
    return this.contactsService.findOne(tenantId, id);
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
