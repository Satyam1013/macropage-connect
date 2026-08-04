import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  DemoRequest,
  DemoRequestSchema,
} from "../schemas/demo-request.schema";
import { DemoRequestsService } from "./demo-requests.service";
import { DemoRequestsController } from "./demo-requests.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DemoRequest.name, schema: DemoRequestSchema },
    ]),
  ],
  providers: [DemoRequestsService],
  controllers: [DemoRequestsController],
})
export class DemoRequestsModule {}
