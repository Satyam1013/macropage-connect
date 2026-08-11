import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../../auth/schemas/user-account-membership.schema";
import { ProjectAccessGuard } from "./project-access.guard";

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: UserAccountMembership.name,
        schema: UserAccountMembershipSchema,
      },
    ]),
  ],
  providers: [ProjectAccessGuard],
  exports: [ProjectAccessGuard],
})
export class ProjectAccessModule {}
