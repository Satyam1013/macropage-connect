import { UserPayload } from "./auth-response.interface";

export type AuthReq = {
  user: UserPayload & { tenantId?: string; role?: string };
};
