import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Lead, LeadSchema } from "../../schemas/lead.schema";
import { PlatformLeadsService } from "./leads.service";
import { PlatformLeadsController } from "./leads.controller";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
  ],
  controllers: [PlatformLeadsController],
  providers: [PlatformLeadsService],
})
export class PlatformLeadsModule {}
