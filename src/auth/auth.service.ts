import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService, User } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { OAuthDto } from "./dto/oauth.dto";
import { AuthResponse } from "./dto/auth-response.interface";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = this.users.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    const valid = await this.users.validatePassword(
      dto.password,
      user.password,
    );
    if (!valid) {
      throw new UnauthorizedException({
        success: false,
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    return this.buildAuthResponse(user, "Authenticated");
  }

  // ─── Signup ───────────────────────────────────────────────────────────────

  async signup(dto: SignupDto): Promise<AuthResponse> {
    if (!dto.termsAccepted) {
      throw new BadRequestException({
        success: false,
        message: "Terms and conditions must be accepted",
        code: "TERMS_NOT_ACCEPTED",
      });
    }

    const user = await this.users.create(dto);
    return this.buildAuthResponse(user, "Account created successfully");
  }

  // ─── OAuth / Social Login ─────────────────────────────────────────────────

  oauthLogin(dto: OAuthDto): Promise<AuthResponse> {
    // TODO: Verify token with respective OAuth provider
    // e.g. for Google: use google-auth-library to verify dto.token
    // Then find-or-create user based on verified profile

    // Placeholder: replace with actual provider verification
    throw new BadRequestException({
      success: false,
      message: `OAuth provider "${dto.provider}" not yet configured`,
      code: "OAUTH_NOT_CONFIGURED",
    });
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  refreshToken(userId: string): { accessToken: string } {
    const user = this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    const accessToken = this.signAccessToken(user.id, user.email);
    return { accessToken };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private buildAuthResponse(user: User, message: string): AuthResponse {
    const accessToken = this.signAccessToken(user.id, user.email);
    const refreshToken = this.signRefreshToken(user.id, user.email);

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: this.users.toPublicProfile(user),
      },
      message,
    };
  }

  private signAccessToken(sub: string, email: string): string {
    const expiresIn = this.config.get<string>(
      "JWT_EXPIRES_IN",
      "15m",
    ) as `${number}${"s" | "m" | "h" | "d"}`;
    return this.jwt.sign(
      { sub, email },
      {
        secret: this.config.get<string>("JWT_SECRET", "fallback-secret"),
        expiresIn,
      },
    );
  }

  private signRefreshToken(sub: string, email: string): string {
    const expiresIn = this.config.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
      "7d",
    ) as `${number}${"s" | "m" | "h" | "d"}`;
    return this.jwt.sign(
      { sub, email },
      {
        secret: this.config.get<string>(
          "JWT_REFRESH_SECRET",
          "fallback-refresh",
        ),
        expiresIn,
      },
    );
  }
}
