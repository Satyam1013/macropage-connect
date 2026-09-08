import { UserPayload } from "./auth-response.interface";

export type AuthReq = {
  user: UserPayload & { tenantId?: string; role?: string };
  // Attached by ProjectAccessGuard for project-scoped routes
  // (projects/:projectId/...) — undefined on routes without that guard.
  projectId?: string;
  projectRole?: string;
};

// Same shape, but for handlers on a route that always carries
// ProjectAccessGuard — projectId/projectRole are guaranteed set by the
// time the handler runs, so callers don't need `!`/optional-chaining.
export type ProjectAuthReq = AuthReq & {
  projectId: string;
  projectRole: string;
};
