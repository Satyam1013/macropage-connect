import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { JwtPayload } from "../auth.types";
import { AccountStatusService } from "../../account-status/account-status.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly accountStatus: AccountStatusService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET", "fallback-secret"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException("User not found");

    // Runs on every authenticated request (the user is re-read from Mongo
    // each time), so a suspension/deletion cuts off already-issued tokens
    // immediately — no need to wait for them to expire.
    this.accountStatus.assertUserActive(user);
    // Legacy team members carry their employer's tenantId; block them too
    // when that customer is suspended. (Project-scoped routes are covered
    // by ProjectAccessGuard; staff have no tenant of their own.)
    if (
      !user.platformRole &&
      user.tenantId &&
      String(user.tenantId) !== String(user._id)
    ) {
      await this.accountStatus.assertTenantActive(String(user.tenantId));
    }
    return user;
  }
}
