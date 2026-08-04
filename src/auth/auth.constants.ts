export enum UserRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  AGENT = "AGENT",
}

// Platform-staff role — deliberately separate from UserRole above.
// UserRole is a tenant's own team hierarchy (a customer's staff); a
// tenant's "ADMIN" must never satisfy a PlatformRole check. Only accounts
// migrated via scripts/migrate-admin-users.ts carry this field.
export enum PlatformRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  SUPPORT_AGENT = "SUPPORT_AGENT",
}
