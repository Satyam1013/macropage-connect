import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Tenant, TenantSchema } from "../schemas/tenant.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { TenantResolverService } from "./tenant-resolver.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [TenantResolverService],
  exports: [TenantResolverService],
})
export class TenantModule {}
