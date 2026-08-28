export type PublicAuthConfig = {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  scope: string;
  startupMode: "login-required" | "check-sso";
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentCheckSsoRedirectUri: string;
  silentCheckSsoEnabled: boolean;
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
  givenName?: string;
  familyName?: string;
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

export type TokenSnapshot = {
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  authorizationToken: string | null;
  accessTokenParsed: Record<string, unknown> | null;
  idTokenParsed: Record<string, unknown> | null;
  authorizationTokenParsed: Record<string, unknown> | null;
};

export type TokenRefreshEvent = {
  refreshedAt: string;
  source: "background" | "api" | "manual";
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
  authorizationTokenMocked: boolean;
  tokens: TokenSnapshot;
  inactivityRemainingMs: number | null;
  accessTokenExpiresInMs: number | null;
  lastTokenRefresh: TokenRefreshEvent | null;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string>;
  getAuthorizationToken: () => Promise<string>;
  ensureValidAccessToken: (source?: TokenRefreshEvent["source"]) => Promise<string>;
  ensureValidAuthorizationToken: () => Promise<string>;
  authenticatedFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  recordActivity: () => void;
};
