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
  | "NOTE"
  | "SYSTEM";

export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
