import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  SampleTemplate,
  SampleTemplateSchema,
} from "../schemas/sample-template.schema";
import { SampleTemplatesService } from "./sample-templates.service";
import { SampleTemplatesController } from "./sample-templates.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SampleTemplate.name, schema: SampleTemplateSchema },
    ]),
  ],
  providers: [SampleTemplatesService],
  controllers: [SampleTemplatesController],
})
export class SampleTemplatesModule {}
