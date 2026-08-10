import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import {
  WABAAccount,
  WABAAccountSchema,
} from "../schemas/waba-account.schema";
import { User, UserSchema } from "../users/schemas/user.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WABAAccount.name, schema: WABAAccountSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
