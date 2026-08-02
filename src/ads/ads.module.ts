import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Ad, AdSchema } from "../schemas/ad.schema";
import { AdTag, AdTagSchema } from "../schemas/ad-tag.schema";
import { AdsService } from "./ads.service";
import { AdsController } from "./ads.controller";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ad.name, schema: AdSchema },
      { name: AdTag.name, schema: AdTagSchema },
    ]),
  ],
  providers: [AdsService],
  controllers: [AdsController],
})
export class AdsModule {}
