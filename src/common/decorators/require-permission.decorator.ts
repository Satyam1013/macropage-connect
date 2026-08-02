import { SetMetadata } from "@nestjs/common";

export const API_PERMISSION_KEY = "apiPermission";
export const RequirePermission = (permission: string) =>
  SetMetadata(API_PERMISSION_KEY, permission);
