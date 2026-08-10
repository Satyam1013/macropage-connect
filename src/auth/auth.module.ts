import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { UsersModule } from "../users/users.module";
import { BillingModule } from "../billing/billing.module";
import { QueueModule } from "../queue/queue.module";
import { EmailService } from "../queue/email.service";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "../schemas/refresh-token.schema";
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from "../schemas/password-reset-token.schema";
import { Session, SessionSchema } from "../schemas/session.schema";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "./schemas/user-account-membership.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";

@Module({
  imports: [
    UsersModule,
    BillingModule,
    PassportModule,
    ConfigModule,
    QueueModule,
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: Session.name, schema: SessionSchema },
      {
        name: UserAccountMembership.name,
        schema: UserAccountMembershipSchema,
      },
      { name: Tenant.name, schema: TenantSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET", "fallback-secret"),
        signOptions: { expiresIn: "24h" as const },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, EmailService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
