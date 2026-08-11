import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  HttpCode,
  HttpStatus,
  Header,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access.guard";
import { UsersService } from "./users.service";
import { ActivityService } from "./activity.service";
import { UploadService } from "../upload/upload.service";
import { BillingService } from "../billing/billing.service";
import { TenantResolverService } from "../tenant/tenant-resolver.service";
import type { ProjectAuthReq } from "../auth/dto/auth-request.interface";

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

@UseGuards(JwtAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly activityService: ActivityService,
    private readonly uploadService: UploadService,
    private readonly billingService: BillingService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Get("me")
  @Header("Cache-Control", "no-cache, no-store, must-revalidate")
  async getMe(@Request() req: ProjectAuthReq) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) return { success: true, data: { user: null } };

    const tenantId = req.projectId;
    // Plan/subscription is a property of the person's own MAIN account
    // only — see TenantResolverService.resolveBillingTenantId. Company
    // name/logo (tenantFields below) reflect the project in the URL.
    const billingTenantId = await this.tenantResolver.resolveBillingTenantId(
      user.id,
      tenantId,
    );
    const [sub, tenantFields] = await Promise.all([
      this.billingService.getSubscription(billingTenantId),
      this.usersService.resolveTenantFields(user, tenantId),
    ]);

    return {
      success: true,
      data: {
        user: {
          ...user.toObject(),
          ...tenantFields,
          avatarUrl: user.avatarUrl ?? null,
          currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
        },
      },
    };
  }

  @Patch("me")
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @Request() req: ProjectAuthReq,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(req.user.id, dto);
    return {
      success: true,
      data: {
        user: updated && {
          ...updated.toObject(),
          avatarUrl: updated.avatarUrl ?? null,
        },
      },
    };
  }

  @Post("me/avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadAvatar(
    @Request() req: ProjectAuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const tenantId = req.projectId;
    const { url } = await this.uploadService.uploadImage(tenantId, file);
    await this.usersService.updateProfile(req.user.id, { avatarUrl: url });
    return { success: true, data: { avatarUrl: url } };
  }

  @Get("activity")
  getUserActivity(
    @Request() req: ProjectAuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
  ) {
    const tenantId = req.projectId;
    return this.activityService.getUserActivity(
      tenantId,
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      type,
    );
  }
}
