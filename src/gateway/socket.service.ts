import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class SocketService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server | null {
    return this.server;
  }

  // ── Low-level emitters ────────────────────────────────────────────────────

  emitToTenant(tenantId: string, event: string, data: unknown) {
    this.server?.to(`tenant:${tenantId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server?.to(`conv:${conversationId}`).emit(event, data);
  }

  // ── Named emit methods ────────────────────────────────────────────────────

  newMessage(tenantId: string, message: Record<string, unknown>) {
    this.emitToTenant(tenantId, "message:new", message);
    const convId = String(message.conversationId ?? "");
    if (convId) this.emitToConversation(convId, "message:new", message);
  }

  messageStatus(
    tenantId: string,
    data: {
      messageId: string;
      conversationId: string;
      status: string;
      timestamp?: string;
    },
  ) {
    this.emitToTenant(tenantId, "message:status", data);
    if (data.conversationId)
      this.emitToConversation(data.conversationId, "message:status", data);
  }

  conversationCreated(tenantId: string, conversation: unknown) {
    this.emitToTenant(tenantId, "conversation:new", conversation);
  }

  conversationUpdated(tenantId: string, conversation: unknown) {
    this.emitToTenant(tenantId, "conversation:updated", conversation);
  }

  campaignProgress(
    tenantId: string,
    data: { campaignId: string; sent: number; total: number; status: string },
  ) {
    this.emitToTenant(tenantId, "campaign:progress", data);
  }

  campaignCompleted(tenantId: string, campaign: unknown) {
    this.emitToTenant(tenantId, "campaign:completed", campaign);
  }

  notification(userId: string, notification: unknown) {
    this.emitToUser(userId, "notification:new", notification);
  }

  agentPresence(
    tenantId: string,
    data: {
      userId: string;
      name: string;
      avatarUrl?: string;
      status: "online" | "away" | "offline";
    },
  ) {
    this.emitToTenant(tenantId, "agent:presence", data);
  }

  wabaQualityChanged(
    tenantId: string,
    data: { qualityRating: string; messagingTier: string },
  ) {
    this.emitToTenant(tenantId, "waba:quality_changed", data);
  }

  planChanged(
    tenantId: string,
    data: { plan: string; subscriptionActive: boolean },
  ) {
    this.emitToTenant(tenantId, "plan:changed", data);
  }

  importProgress(
    tenantId: string,
    data: { jobId: string; processed: number; total: number; status: string },
  ) {
    this.emitToTenant(tenantId, "import:progress", data);
  }

  botHandoff(tenantId: string, conversationId: string) {
    this.emitToTenant(tenantId, "bot:handoff", { conversationId });
  }

  async disconnectUser(userId: string) {
    if (!this.server) return;
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      socket.emit("force:logout", {
        reason: "Your account access has been revoked",
      });
      socket.disconnect();
    }
  }
}
