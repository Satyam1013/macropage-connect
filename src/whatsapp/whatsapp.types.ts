export interface WABADetailsData {
  connected: true;
  businessName: string | null;
  wabaId: string | null;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  qualityRating: string;
  messagingTier: string;
  tierLimit: number;
  messagesToday: number;
  messagesThisMonth: number;
  usagePercent: number;
  tokenExpired: boolean;
  tokenExpiresAt: Date | null;
  webhookUrl: string;
  webhookVerified: boolean;
  nameStatus: string | null;
  phoneStatus: string | null;
  needsReregister: boolean;
  requestedDisplayName: string | null;
  reregisterError: string | null;
  accountRestricted: boolean;
  accountStatusEvent: string | null;
  lastSyncedAt: Date | null;
  connectedAt: Date | undefined;
  updatedAt: Date | undefined;
}
