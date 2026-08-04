import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { TagsService } from "./tags.service";
import { CreateTagDto } from "./dto/create-tag.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { AssignTagsDto } from "./dto/assign-tags.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlatformRolesGuard } from "../common/guards/platform-roles.guard";
import { PlatformRoles } from "../common/decorators/platform-roles.decorator";
import { PlatformRole } from "../auth/auth.constants";

// Platform-staff only — tags aren't exposed to tenants directly, only
// consumed internally (see ads/ads.service.ts) to resolve tag-targeted ads.
@UseGuards(JwtAuthGuard, PlatformRolesGuard)
@PlatformRoles(PlatformRole.SUPER_ADMIN)
@Controller("platform/tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAll() {
    return this.tagsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tagsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTagDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tagsService.remove(id);
  }

  @Post("assign")
  assignToCustomer(@Body() dto: AssignTagsDto) {
    return this.tagsService.assignToCustomer(dto);
  }
}
