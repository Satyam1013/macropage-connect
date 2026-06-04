import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";

@WebSocketGateway({
  cors: { origin: "*", credentials: true },
  namespace: "/",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify<{ sub: string; tenantId: string }>(
        token,
        {
          secret: this.config.get("JWT_SECRET"),
        },
      );

      const user = await this.userModel.findById(payload.sub).exec();
      if (!user) {
        client.disconnect();
        return;
      }

      (client as Socket & { user: UserDocument }).user = user;

      const tenantId: string =
        (user as UserDocument & { tenantId?: string }).tenantId ??
        payload.tenantId ??
        "";
      void client.join(`tenant:${tenantId}`);
      void client.join(`user:${user.id}`);

      this.logger.log(`Client connected: ${user.email}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join:conversation")
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): void {
    void client.join(`conv:${conversationId}`);
  }

  @SubscribeMessage("leave:conversation")
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ): void {
    void client.leave(`conv:${conversationId}`);
  }

  @SubscribeMessage("typing:start")
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ): void {
    const user = (client as Socket & { user?: UserDocument }).user;
    client.to(`conv:${body.conversationId}`).emit("agent:typing", {
      agentId: user?.id,
    });
  }

  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToConversation(
    conversationId: string,
    event: string,
    data: unknown,
  ): void {
    this.server.to(`conv:${conversationId}`).emit(event, data);
  }
}
