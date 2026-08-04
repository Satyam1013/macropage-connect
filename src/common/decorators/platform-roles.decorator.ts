import { SetMetadata } from "@nestjs/common";
import { PlatformRole } from "../../auth/auth.constants";

export const PLATFORM_ROLES_KEY = "platformRoles";
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata(PLATFORM_ROLES_KEY, roles);
