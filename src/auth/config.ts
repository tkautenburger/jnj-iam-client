import type { PublicAuthConfig } from "./types";

const DEFAULT_SCOPE = "openid profile email nucleus";
const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_INACTIVITY_WARNING_MS = 60 * 1000;
const DEFAULT_MOCK_AUTHORIZATION_ROLES = ["user"];

function getRootUrl(): string {
  if (process.env.EXT_JNJ_ROOT_URL) {
    return process.env.EXT_JNJ_ROOT_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readList(name: string, fallback: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return entries.length > 0 ? entries : fallback;
}

export function getPublicAuthConfig(): PublicAuthConfig {
  const rootUrl = getRootUrl();

  return {
    keycloakUrl: process.env.EXT_JNJ_IAM_URL ?? "https://localhost",
    realm: process.env.EXT_JNJ_IAM_REALM_NAME ?? "phnc-dev",
    clientId: process.env.EXT_JNJ_IAM_CLIENT_ID ?? "phnc-test-app",
    scope: process.env.EXT_JNJ_IAM_SCOPE ?? DEFAULT_SCOPE,
    redirectUri: process.env.EXT_JNJ_IAM_REDIRECT_URI ?? `${rootUrl}/signin`,
    postLogoutRedirectUri: process.env.EXT_JNJ_IAM_POST_LOGOUT_REDIRECT_URI ?? `${rootUrl}/`,
    silentCheckSsoRedirectUri: process.env.EXT_JNJ_IAM_SILENT_CHECK_SSO_REDIRECT_URI ?? `${rootUrl}/sso-signin`,
    silentCheckSsoEnabled: readBoolean("EXT_JNJ_IAM_SILENT_CHECK_SSO_ENABLED", false),
    tmsV2RootUrl: process.env.EXT_JNJ_TMS_V2_ROOT_URL ?? rootUrl,
    tenantId: process.env.EXT_JNJ_TENANT_ID,
    mockAuthorizationToken: readBoolean("EXT_JNJ_MOCK_AUTHORIZATION_TOKEN", true),
    mockAuthorizationApp: process.env.EXT_JNJ_MOCK_AUTHORIZATION_APP ?? process.env.EXT_JNJ_IAM_CLIENT_ID ?? "phnc-test-app",
    mockAuthorizationTenant: process.env.EXT_JNJ_MOCK_AUTHORIZATION_TENANT ?? process.env.EXT_JNJ_TENANT_ID ?? "local-test",
    mockAuthorizationRoles: readList("EXT_JNJ_MOCK_AUTHORIZATION_ROLES", DEFAULT_MOCK_AUTHORIZATION_ROLES),
    inactivityTimeoutMs: readNumber("EXT_JNJ_IAM_USER_INACTIVITY_TIMEOUT", DEFAULT_INACTIVITY_TIMEOUT_MS),
    inactivityWarningMs: readNumber("EXT_JNJ_IAM_INACTIVITY_WARNING_TIMEOUT", DEFAULT_INACTIVITY_WARNING_MS)
  };
}
