export type PublicAuthConfig = {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentCheckSsoRedirectUri: string;
  tmsV2RootUrl: string;
  tenantId?: string;
  mockAuthorizationToken: boolean;
  mockAuthorizationApp: string;
  mockAuthorizationTenant: string;
  mockAuthorizationRoles: string[];
  inactivityTimeoutMs: number;
  inactivityWarningMs: number;
};

export type UserProfile = {
  subject?: string;
  preferredUsername?: string;
  name?: string;
  email?: string;
  nucleus?: unknown;
  organization?: unknown;
};

export type AuthorizationClaims = {
  app: string;
  tnt: string;
  roles: string[];
  exp: number;
};

export type AuthStatus =
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "access-denied"
  | "error"
  | "logging-out";

export type AuthContextValue = {
  status: AuthStatus;
  initialized: boolean;
  authenticated: boolean;
  user: UserProfile | null;
  authorizationClaims: AuthorizationClaims | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  getAuthorizationToken: () => Promise<string>;
  ensureValidAccessToken: () => Promise<string>;
  ensureValidAuthorizationToken: () => Promise<string>;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  recordActivity: () => void;
};
