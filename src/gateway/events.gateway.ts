import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Server, Socket as BaseSocket, DefaultEventsMap } from "socket.io";
import { SocketService } from "./socket.service";
import { SocketData } from "./gateway.types";
import {
  SupportTicket,
  SupportTicketDocument,
} from "../schemas/support-ticket.schema";
import { SupportChatService } from "../support-chat/support-chat.service";
import type { ChatSenderType } from "../support-chat/schemas/chat-message.schema";

// Local alias needed: cross-module type aliases break emitDecoratorMetadata in decorated params
type AppSocket = BaseSocket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
import { User, UserDocument } from "../users/schemas/user.schema";

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ??
  process.env.FRONTEND_URL ??
  "*"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin:
      allowedOrigins.length === 1 && allowedOrigins[0] === "*"
        ? "*"
        : allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 60000,
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // socketId → { userId, tenantId, role, name }
  private socketMeta = new Map<
    string,
    { userId: string; tenantId: string; role: string; name: string }
  >();
  // userId → Set<socketId>  (multiple tabs)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly socketService: SocketService,
    private readonly supportChatService: SupportChatService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(SupportTicket.name)
    private readonly ticketModel: Model<SupportTicketDocument>,
  ) {}

  // ── INIT ──────────────────────────────────────────────────────────────────

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log("[Gateway] Socket.IO initialized");
  }

  // ── CONNECTION ────────────────────────────────────────────────────────────

  async handleConnection(client: AppSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace("Bearer ", "") ??
        (client.handshake.query.token as string | undefined);

      if (!token) {
        client.emit("error", { code: "UNAUTHORIZED", message: "No token" });
        client.disconnect();
        return;
      }

      let payload: { sub: string; tenantId?: string; role?: string };
      try {
        payload = this.jwt.verify(token, {
          secret: this.config.get("JWT_SECRET"),
        });
      } catch {
        client.emit("error", {
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        });
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      const user = await this.userModel
        .findById(userId)
        .select(
          "_id name email avatarUrl role tenantId onlineStatus platformRole",
        )
        .lean()
        .exec();

      if (!user) {
        client.emit("error", {
          code: "UNAUTHORIZED",
          message: "User not found",
        });
        client.disconnect();
        return;
      }

      const tenantId = user.tenantId ?? payload.tenantId ?? userId;

      // Attach to socket
      client.data.userId = userId;
      client.data.tenantId = tenantId;
      client.data.role = user.role;
      client.data.name = user.name;
      client.data.platformRole = user.platformRole;

      // Join rooms
      await client.join(`tenant:${tenantId}`);
      await client.join(`user:${userId}`);

      // Track
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketMeta.set(client.id, {
        userId,
        tenantId,
        role: user.role,
        name: user.name,
      });

      // Mark online
      await this.userModel
        .findByIdAndUpdate(userId, {
          onlineStatus: "online",
          lastActiveAt: new Date(),
        })
        .exec();

      // Broadcast presence
      this.socketService.agentPresence(tenantId, {
        userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        status: "online",
      });

      client.emit("connected", { socketId: client.id, userId, tenantId });
      this.logger.log(
        `Connected: ${user.name} (${userId}) socket:${client.id}`,
      );
    } catch (err) {
      this.logger.error("Connection error:", err);
      client.disconnect();
    }
  }

  // ── DISCONNECTION ─────────────────────────────────────────────────────────

  async handleDisconnect(client: AppSocket): Promise<void> {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;

    const { userId, tenantId, name } = meta;
    this.socketMeta.delete(client.id);

    const set = this.userSockets.get(userId);
    if (set) {
      set.delete(client.id);
      if (set.size === 0) {
        this.userSockets.delete(userId);
        await this.userModel
          .findByIdAndUpdate(userId, {
            onlineStatus: "offline",
            lastActiveAt: new Date(),
          })
          .exec()
          .catch(() => undefined);

        this.socketService.agentPresence(tenantId, {
          userId,
          name,
          status: "offline",
        });
      }
    }

    this.logger.log(`Disconnected: ${userId} socket:${client.id}`);
  }

  // ── SUPPORT TICKET CHAT ────────────────────────────────────────────────────
  // Only the ticket's own tenant, or platform staff, may join/message a
  // ticket room — prevents an unrelated tenant from reading another
  // tenant's support conversation just by knowing the ticket id.

  private async canAccessTicket(client: AppSocket, ticketId: string) {
    if (client.data.platformRole) return true;
    const ticket = await this.ticketModel
      .findById(ticketId)
      .select("tenantId")
      .lean()
      .exec();
    return !!ticket && ticket.tenantId === client.data.tenantId;
  }

  @SubscribeMessage("ticket:join")
  async handleJoinTicket(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() data: { ticketId: string },
  ) {
    if (!(await this.canAccessTicket(client, data.ticketId))) {
      client.emit("error", { code: "FORBIDDEN", message: "Ticket not found" });
      return;
    }
    await client.join(`ticket:${data.ticketId}`);
    const history = await this.supportChatService.getHistory(data.ticketId);
    client.emit("ticket:history", history);
  }

  @SubscribeMessage("ticket:message")
  async handleTicketMessage(
    @ConnectedSocket() client: AppSocket,
    @MessageBody()
    data: { ticketId: string; senderType: ChatSenderType; message: string },
  ) {
    if (!(await this.canAccessTicket(client, data.ticketId))) {
      client.emit("error", { code: "FORBIDDEN", message: "Ticket not found" });
      return;
    }
    const savedMessage = await this.supportChatService.saveMessage({
      ticketId: data.ticketId,
      senderType: data.senderType,
      senderId: client.data.userId,
      message: data.message,
    });
    this.server.to(`ticket:${data.ticketId}`).emit("ticket:message", savedMessage);
  }

  // ── CONVERSATION ROOM ─────────────────────────────────────────────────────

  @SubscribeMessage("join:conversation")
  async handleJoinConversation(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() payload: { conversationId: string } | string,
  ) {
    const convId =
      typeof payload === "string" ? payload : payload.conversationId;
    if (!convId) return;
    await client.join(`conv:${convId}`);
    client.emit("joined:conversation", { conversationId: convId });
  }

  @SubscribeMessage("leave:conversation")
  async handleLeaveConversation(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() payload: { conversationId: string } | string,
  ) {
    const convId =
      typeof payload === "string" ? payload : payload.conversationId;
    if (!convId) return;
    await client.leave(`conv:${convId}`);
    client.emit("left:conversation", { conversationId: convId });
  }

  // ── TYPING ────────────────────────────────────────────────────────────────

  @SubscribeMessage("typing:start")
  handleTypingStart(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    client.to(`conv:${body.conversationId}`).emit("agent:typing", {
      agentId: client.data.userId,
      agentName: client.data.name,
      conversationId: body.conversationId,
    });
  }

  @SubscribeMessage("typing:stop")
  handleTypingStop(
    @ConnectedSocket() client: AppSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    client.to(`conv:${body.conversationId}`).emit("agent:typing:stop", {
      agentId: client.data.userId,
      conversationId: body.conversationId,
    });
  }

  // ── PRESENCE ──────────────────────────────────────────────────────────────

  @SubscribeMessage("presence:away")
  async handlePresenceAway(@ConnectedSocket() client: AppSocket) {
    const { userId, tenantId, name } = client.data as {
      userId: string;
      tenantId: string;
      name: string;
    };
    await this.userModel
      .findByIdAndUpdate(userId, { onlineStatus: "away" })
      .exec();
    this.socketService.agentPresence(tenantId, {
      userId,
      name,
      status: "away",
    });
    client.emit("presence:updated", { status: "away" });
  }

  @SubscribeMessage("presence:active")
  async handlePresenceActive(@ConnectedSocket() client: AppSocket) {
    const { userId, tenantId, name } = client.data as {
      userId: string;
      tenantId: string;
      name: string;
    };
    await this.userModel
      .findByIdAndUpdate(userId, {
        onlineStatus: "online",
        lastActiveAt: new Date(),
      })
      .exec();
    this.socketService.agentPresence(tenantId, {
      userId,
      name,
      status: "online",
    });
    client.emit("presence:updated", { status: "online" });
  }

  // ── ONLINE AGENTS ─────────────────────────────────────────────────────────

  @SubscribeMessage("get:online-agents")
  async handleGetOnlineAgents(@ConnectedSocket() client: AppSocket) {
    const { tenantId } = client.data as { tenantId: string };
    const agents = await this.userModel
      .find({ tenantId, onlineStatus: { $in: ["online", "away"] } })
      .select("_id name avatarUrl role onlineStatus")
      .lean()
      .exec();
    client.emit("online-agents", { agents });
  }

  // ── PING KEEPALIVE ────────────────────────────────────────────────────────

  @SubscribeMessage("ping")
  handlePing(@ConnectedSocket() client: AppSocket) {
    void this.userModel
      .findByIdAndUpdate(client.data.userId, {
        lastActiveAt: new Date(),
      })
      .exec()
      .catch(() => undefined);
    client.emit("pong", { timestamp: Date.now() });
  }

  // ── DIRECT EMIT HELPERS (for backward compat) ─────────────────────────────

  emitToTenant(tenantId: string, event: string, data: unknown): void {
    this.socketService.emitToTenant(tenantId, event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.socketService.emitToUser(userId, event, data);
  }

  emitToConversation(
    conversationId: string,
    event: string,
    data: unknown,
  ): void {
    this.socketService.emitToConversation(conversationId, event, data);
  }
}
