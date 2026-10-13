import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { AccountStatusService } from "./account-status.service";

// Global: the check runs in auth, guards, the socket gateway and the Meta
// client — wiring it into each of those modules would be noise.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
    ]),
  ],
  providers: [AccountStatusService],
  exports: [AccountStatusService],
})
export class AccountStatusModule {}
