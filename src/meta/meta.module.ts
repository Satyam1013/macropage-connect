import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { WABAAccount, WABAAccountSchema } from "../schemas/waba-account.schema";
import { MetaService } from "./meta.service";
import { EncryptionService } from "./encryption.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
    ]),
  ],
  providers: [MetaService, EncryptionService],
  exports: [MetaService, EncryptionService],
})
export class MetaModule {}
