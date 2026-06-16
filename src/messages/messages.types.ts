export type MessageDirection = "INBOUND" | "OUTBOUND";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "DOCUMENT"
  | "AUDIO"
  | "TEMPLATE"
  | "INTERACTIVE"
  | "LOCATION"
  | "STICKER"
  | "REACTION"
  | "CONTACTS"
  | "ORDER"
  | "NOTE"
  | "SYSTEM";

export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
