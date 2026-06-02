import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { OAuthDto } from "./dto/oauth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { UserPayload } from "./dto/auth-response.interface";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/signup
   * Register a new user
   */
  @Post("signup")
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /**
   * POST /auth/login
   * Authenticate with email + password
   */
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/oauth
   * Authenticate via OAuth provider (Google, Facebook, etc.)
   */
  @Post("oauth")
  @HttpCode(HttpStatus.OK)
  oauthLogin(@Body() dto: OAuthDto) {
    return this.authService.oauthLogin(dto);
  }

  /**
   * POST /auth/refresh
   * Refresh access token (requires valid JWT)
   */
  @UseGuards(JwtAuthGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Request() req: { user: UserPayload }) {
    return this.authService.refreshToken(req.user.id);
  }

  /**
   * GET /auth/me
   * Get current authenticated user profile
   */
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Request() req: { user: UserPayload }) {
    return {
      success: true,
      data: { user: req.user },
    };
  }
}
