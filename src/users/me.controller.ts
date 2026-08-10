import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
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
import { UsersService } from "./users.service";
import { UploadService } from "../upload/upload.service";
import { BillingService } from "../billing/billing.service";
import { TenantResolverService } from "../tenant/tenant-resolver.service";
import type { AuthReq } from "../auth/dto/auth-request.interface";

// Every field needs a validator, or the global ValidationPipe's
// whitelist:true strips it from the request before it ever reaches the
// controller — an undecorated DTO makes every PUT here a silent no-op.
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

// Bare /api/v1/me alias for /api/v1/users/me — some frontend calls hit this
// path directly instead of the users-prefixed one.
@UseGuards(JwtAuthGuard)
@Controller("me")
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadService: UploadService,
    private readonly billingService: BillingService,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-cache, no-store, must-revalidate")
  async getMe(@Request() req: AuthReq) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) return { success: true, data: { user: null } };

    const tenantId = user.tenantId ?? user.id;
    // Plan/subscription is a property of the person's own MAIN account
    // only — see TenantResolverService.resolveBillingTenantId. Company
    // name/logo (tenantFields below) still reflect whichever account is
    // currently selected, since that's what the viewed workspace is.
    const billingTenantId = await this.tenantResolver.resolveBillingTenantId(
      user.id,
      tenantId,
    );
    const [sub, tenantFields] = await Promise.all([
      this.billingService.getSubscription(billingTenantId),
      this.usersService.resolveTenantFields(user),
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

  @Put()
  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateMe(@Request() req: AuthReq, @Body() dto: UpdateProfileDto) {
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

  @Post("avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor("file"))
  async uploadAvatar(
    @Request() req: AuthReq,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    const tenantId = req.user.tenantId ?? req.user.id;
    const { url } = await this.uploadService.uploadImage(tenantId, file);
    await this.usersService.updateProfile(req.user.id, { avatarUrl: url });
    return { success: true, data: { avatarUrl: url } };
  }
}
