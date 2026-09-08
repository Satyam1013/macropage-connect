import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DemoRequest, DemoRequestSchema } from "../schemas/demo-request.schema";
import { DemoRequestsService } from "./demo-requests.service";
import {
  DemoRequestsController,
  DemoRequestsProjectController,
} from "./demo-requests.controller";
import { ProjectAccessModule } from "../common/guards/project-access.module";
import {
  UserAccountMembership,
  UserAccountMembershipSchema,
} from "../auth/schemas/user-account-membership.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DemoRequest.name, schema: DemoRequestSchema },
    ]),
    ProjectAccessModule,
    MongooseModule.forFeature([
      { name: UserAccountMembership.name, schema: UserAccountMembershipSchema },
    ]),
  ],
  providers: [DemoRequestsService],
  controllers: [DemoRequestsController, DemoRequestsProjectController],
})
export class DemoRequestsModule {}
