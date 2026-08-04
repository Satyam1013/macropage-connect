import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { User, UserSchema } from "../users/schemas/user.schema";
import {
  SupportTicket,
  SupportTicketSchema,
} from "../schemas/support-ticket.schema";
import { EventsGateway } from "./events.gateway";
import { SocketService } from "./socket.service";
import { SupportChatModule } from "../support-chat/support-chat.module";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.get("JWT_SECRET") }),
    }),
    SupportChatModule,
  ],
  providers: [SocketService, EventsGateway],
  exports: [SocketService, EventsGateway],
})
export class GatewayModule {}
