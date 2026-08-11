export interface UserPayload {
  id: string;
  name: string;
  email: string;
  role?: string;
  platformRole?: string;
  phone?: string;
  avatarUrl?: string | null;
  companyName?: string;
  logoUrl?: string | null;
  tenantId?: string;
  emailVerified?: boolean;
  whatsappSetupDone?: boolean;
  plan?: "FREE" | "PRO";
  billingPlan?: string;
  billingCycle?: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string | null;
  subscriptionType?: "free" | "pro" | "business";
  paidUser?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: true;
  data: {
    accessToken?: string;
    refreshToken?: string;
    user: UserPayload;
    requiresProjectSelection?: boolean;
  };
  message: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
}
