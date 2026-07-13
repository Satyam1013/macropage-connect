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
  connectedAt: Date | undefined;
  updatedAt: Date | undefined;
}
