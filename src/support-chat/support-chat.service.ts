import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ChatMessage,
  ChatMessageDocument,
  ChatSenderType,
} from "./schemas/chat-message.schema";

export interface SaveMessageInput {
  ticketId: string;
  senderType: ChatSenderType;
  senderId: string;
  message: string;
}

@Injectable()
export class SupportChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
  ) {}

  saveMessage(input: SaveMessageInput) {
    return this.chatMessageModel.create(input);
  }

  getHistory(ticketId: string) {
    return this.chatMessageModel
      .find({ ticketId })
      .sort({ createdAt: 1 })
      .exec();
  }
}
