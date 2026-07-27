import { IsOptional, IsObject } from "class-validator";

// Every field needs a validator, or the global ValidationPipe's
// whitelist:true strips it from the request before it ever reaches the
// controller — an undecorated DTO makes every PATCH here a silent no-op.
export class UpdatePreferencesDto {
  @IsOptional()
  @IsObject()
  channels?: {
    email?: boolean;
    inApp?: boolean;
    whatsapp?: boolean;
  };

  @IsOptional()
  @IsObject()
  events?: Record<
    string,
    { email?: boolean; inApp?: boolean; whatsapp?: boolean }
  >;

  @IsOptional()
  @IsObject()
  quietHours?: {
    enabled?: boolean;
    from?: string;
    to?: string;
    days?: number[];
  };

  @IsOptional()
  @IsObject()
  digest?: {
    enabled?: boolean;
    frequency?: "never" | "daily" | "weekly";
  };
}
