export interface UserPayload {
  id: string;
  name: string;
  email: string;
  phone?: string;
  emailVerified?: boolean;
  whatsappSetupDone?: boolean;
  plan?: "FREE" | "PRO";
  trialEndsAt?: string;
  subscriptionType?: "free" | "pro" | "business";
  paidUser?: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken?: string;
    user: UserPayload;
  };
  message: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
}
