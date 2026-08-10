import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
  Param,
  Delete,
  NotFoundException,
} from "@nestjs/common";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { OAuthDto } from "./dto/oauth.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SelectAccountDto } from "./dto/select-account.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UserPayload } from "./dto/auth-response.interface";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  googleLogin(@Body("credential") credential: string) {
    return this.authService.googleLogin(credential);
  }

  @Post("oauth")
  @HttpCode(HttpStatus.OK)
  oauthLogin(@Body() dto: OAuthDto) {
    return this.authService.oauthLogin(dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("verify-otp")
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body("email") email: string, @Body("otp") otp: string) {
    return this.authService.verifyEmail(email, otp);
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body("email") email: string) {
    return this.authService.resendVerification(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get("sessions")
  getSessions(@Request() req: { user: UserPayload }) {
    return this.authService.getSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions/:id")
  revokeSession(
    @Request() req: { user: UserPayload },
    @Param("id") sessionId: string,
  ) {
    return this.authService.revokeSession(req.user.id, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("sessions")
  revokeAllSessions(@Request() req: { user: UserPayload }) {
    return this.authService.revokeAllSessions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Request() req: { user: UserPayload }) {
    const user = await this.authService.getMe(req.user.id);
    if (!user) throw new NotFoundException("User not found");
    return { success: true, data: { user } };
  }

  @UseGuards(JwtAuthGuard)
  @Get("my-accounts")
  getMyAccounts(@Request() req: { user: UserPayload }) {
    return this.authService.getMyAccounts(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post("select-account")
  @HttpCode(HttpStatus.OK)
  selectAccount(
    @Request() req: { user: UserPayload },
    @Body() dto: SelectAccountDto,
  ) {
    return this.authService.selectAccount(req.user.id, dto.tenantId);
  }
}
