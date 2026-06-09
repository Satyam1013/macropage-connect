export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED";

export interface ConversationFilters {
  status?: string;
  assignedTo?: string;
  unread?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
