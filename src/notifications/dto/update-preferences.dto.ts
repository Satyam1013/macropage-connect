export class UpdatePreferencesDto {
  channels?: {
    email?: boolean;
    inApp?: boolean;
    whatsapp?: boolean;
  };

  events?: Record<
    string,
    { email?: boolean; inApp?: boolean; whatsapp?: boolean }
  >;

  quietHours?: {
    enabled?: boolean;
    from?: string;
    to?: string;
    days?: number[];
  };

  digest?: {
    enabled?: boolean;
    frequency?: "never" | "daily" | "weekly";
  };
}
