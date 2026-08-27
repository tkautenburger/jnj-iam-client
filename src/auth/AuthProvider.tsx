"use client";

import Keycloak, { type KeycloakTokenParsed } from "keycloak-js";
import { usePathname } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  createMockAuthorizationToken,
  expiresWithin,
  normalizeAuthorizationToken,
  readAuthorizationClaims,
  tryDecodeJwt
} from "./jwt";
import type {
  AuthContextValue,
  AuthStatus,
  AuthorizationClaims,
  PublicAuthConfig,
  TokenRefreshEvent,
  TokenSnapshot,
  UserProfile
} from "./types";

const TOKEN_REFRESH_LEEWAY_SECONDS = 30;
const BACKGROUND_TOKEN_CHECK_MS = 5 * 1000;
const INACTIVITY_DISPLAY_UPDATE_MS = 5 * 1000;
const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "touchstart", "click"] as const;
const ACTIVITY_CHANNEL = "polyphonic-iam-activity";

const AuthContext = createContext<AuthContextValue | null>(null);

type TokenState = {
  token: string;
  claims: AuthorizationClaims;
};

export function AuthProvider({ config, children }: { config: PublicAuthConfig; children: React.ReactNode }) {
  const pathname = usePathname();
  const startedRef = useRef(false);
  const keycloakRef = useRef<Keycloak | null>(null);
  const authorizationTokenRef = useRef<TokenState | null>(null);
  const activityChannelRef = useRef<BroadcastChannel | null>(null);
  const logoutStartedRef = useRef(false);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authorizationClaims, setAuthorizationClaims] = useState<AuthorizationClaims | null>(null);
  const [tokens, setTokens] = useState<TokenSnapshot>({
    accessToken: null,
    idToken: null,
    refreshToken: null,
    accessTokenParsed: null,
    idTokenParsed: null,
    refreshTokenParsed: null
  });
  const [inactivityRemainingMs, setInactivityRemainingMs] = useState<number | null>(null);
  const [accessTokenExpiresInMs, setAccessTokenExpiresInMs] = useState<number | null>(null);
  const [lastTokenRefresh, setLastTokenRefresh] = useState<TokenRefreshEvent | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  function formatAuthError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const keycloakMessage = [record.error, record.error_description].filter(Boolean).join(": ");

      if (keycloakMessage) {
        return keycloakMessage;
      }

      try {
        return JSON.stringify(record, null, 2);
      } catch {
        return "Authentication failed with a non-serializable error object";
      }
    }

    return String(error);
  }

  function isNoSsoSessionError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const record = error as Record<string, unknown>;
    return record.error === "login_required" || record.error === "interaction_required";
  }

  const login = useCallback(async () => {
    await keycloakRef.current?.login({
      redirectUri: config.redirectUri,
      scope: config.scope
    });
  }, [config.redirectUri, config.scope]);

  const logout = useCallback(async () => {
    if (logoutStartedRef.current) {
      return;
    }

    logoutStartedRef.current = true;
    setStatus("logging-out");
    authorizationTokenRef.current = null;
    setAuthorizationClaims(null);

    await keycloakRef.current?.logout({
      redirectUri: config.postLogoutRedirectUri
    });
  }, [config.postLogoutRedirectUri]);

  const enterAccessDenied = useCallback((message: string) => {
    authorizationTokenRef.current = null;
    setAuthorizationClaims(null);
    setError(message);
    setStatus("access-denied");
  }, []);

  const syncTokenSnapshot = useCallback(() => {
    const keycloak = keycloakRef.current;
    const accessToken = keycloak?.token ?? null;
    const idToken = keycloak?.idToken ?? null;
    const refreshToken = keycloak?.refreshToken ?? null;

    setTokens({
      accessToken,
      idToken,
      refreshToken,
      accessTokenParsed: tryDecodeJwt(accessToken ?? undefined),
      idTokenParsed: tryDecodeJwt(idToken ?? undefined),
      refreshTokenParsed: tryDecodeJwt(refreshToken ?? undefined)
    });
  }, []);

  const ensureValidAccessToken = useCallback(async (source: TokenRefreshEvent["source"] = "api") => {
    const keycloak = keycloakRef.current;

    if (!keycloak?.authenticated) {
      throw new Error("User is not authenticated");
    }

    try {
      const refreshed = await keycloak.updateToken(TOKEN_REFRESH_LEEWAY_SECONDS);
      syncTokenSnapshot();

      if (refreshed) {
        setLastTokenRefresh({
          refreshedAt: new Date().toLocaleTimeString(),
          source
        });
      }
    } catch (refreshError) {
      setError(formatAuthError(refreshError));
      await login();
      throw refreshError;
    }

    if (!keycloak.token) {
      throw new Error("Keycloak access token is unavailable");
    }

    return keycloak.token;
  }, [login, syncTokenSnapshot]);

  const getAccessToken = useCallback(() => ensureValidAccessToken(), [ensureValidAccessToken]);

  const requestAuthorizationToken = useCallback(async () => {
    const accessToken = await ensureValidAccessToken();

    if (config.mockAuthorizationToken) {
      const claims = {
        app: config.mockAuthorizationApp,
        tnt: config.mockAuthorizationTenant,
        roles: config.mockAuthorizationRoles,
        exp: Math.floor(Date.now() / 1000) + TOKEN_REFRESH_LEEWAY_SECONDS + 60
      };
      const token = createMockAuthorizationToken(claims);
      authorizationTokenRef.current = { token, claims };
      setAuthorizationClaims(claims);
      return token;
    }

    const tokenUrl = new URL(`${config.tmsV2RootUrl.replace(/\/$/, "")}/api/v2/token`);

    if (config.tenantId) {
      tokenUrl.searchParams.set("tenantId", config.tenantId);
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`TMSv2 authorization token request failed with ${response.status}`);
    }

    const headerValue = response.headers.get("X-Authorization");
    if (!headerValue) {
      throw new Error("TMSv2 response did not include X-Authorization");
    }

    const token = normalizeAuthorizationToken(headerValue);
    const claims = readAuthorizationClaims(token);
    authorizationTokenRef.current = { token, claims };
    setAuthorizationClaims(claims);
    return token;
  }, [
    config.mockAuthorizationApp,
    config.mockAuthorizationRoles,
    config.mockAuthorizationTenant,
    config.mockAuthorizationToken,
    config.tenantId,
    config.tmsV2RootUrl,
    ensureValidAccessToken
  ]);

  const ensureValidAuthorizationToken = useCallback(async () => {
    const cached = authorizationTokenRef.current;

    if (cached && !expiresWithin(cached.claims, TOKEN_REFRESH_LEEWAY_SECONDS)) {
      return cached.token;
    }

    try {
      return await requestAuthorizationToken();
    } catch (authorizationError) {
      enterAccessDenied(formatAuthError(authorizationError));
      throw authorizationError;
    }
  }, [enterAccessDenied, requestAuthorizationToken]);

  const getAuthorizationToken = useCallback(
    () => ensureValidAuthorizationToken(),
    [ensureValidAuthorizationToken]
  );

  const authenticatedFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const accessToken = await ensureValidAccessToken();
      const authorizationToken = await ensureValidAuthorizationToken();
      const headers = new Headers(init.headers);

      headers.set("Authorization", `Bearer ${accessToken}`);
      headers.set("X-Authorization", authorizationToken);

      return fetch(input, {
        ...init,
        headers
      });
    },
    [ensureValidAccessToken, ensureValidAuthorizationToken]
  );

  const recordActivity = useCallback(() => {
    const timestamp = Date.now();
    setLastActivityAt(timestamp);
    setShowInactivityWarning(false);
    activityChannelRef.current?.postMessage({ type: "activity", timestamp });
  }, []);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    async function initialize() {
      const keycloak = new Keycloak({
        url: config.keycloakUrl,
        realm: config.realm,
        clientId: config.clientId
      });

      keycloakRef.current = keycloak;

      try {
        const initOptions = {
          onLoad: "check-sso" as const,
          pkceMethod: "S256" as const,
          checkLoginIframe: false,
          redirectUri: config.redirectUri,
          scope: config.scope,
          ...(config.silentCheckSsoEnabled
            ? {
                silentCheckSsoRedirectUri: config.silentCheckSsoRedirectUri
              }
            : {})
        };
        const authenticated = await keycloak.init({
          ...initOptions
        });

        if (!authenticated) {
          setStatus("unauthenticated");
          await keycloak.login({
            redirectUri: config.redirectUri,
            scope: config.scope
          });
          return;
        }

        setUser(getProfile(keycloak.idTokenParsed));
        syncTokenSnapshot();
        try {
          await requestAuthorizationToken();
        } catch (authorizationError) {
          enterAccessDenied(formatAuthError(authorizationError));
          return;
        }

        setStatus("authenticated");
      } catch (initError) {
        if (isNoSsoSessionError(initError)) {
          setStatus("unauthenticated");
          await keycloak.login({
            redirectUri: config.redirectUri,
            scope: config.scope
          });
          return;
        }

        setError(formatAuthError(initError));
        setStatus("error");
      }
    }

    initialize();
  }, [config, enterAccessDenied, requestAuthorizationToken, syncTokenSnapshot]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    activityChannelRef.current = channel;
    const updateFromEvent = () => recordActivity();

    channel.onmessage = (event: MessageEvent<{ type?: string; timestamp?: number }>) => {
      if (event.data.type === "activity" && typeof event.data.timestamp === "number") {
        setLastActivityAt((current) => Math.max(current, event.data.timestamp ?? current));
        setShowInactivityWarning(false);
      }
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, updateFromEvent, { passive: true });
    }

    return () => {
      channel.close();
      activityChannelRef.current = null;
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, updateFromEvent);
      }
    };
  }, [recordActivity, status]);

  useEffect(() => {
    if (status === "authenticated") {
      recordActivity();
    }
  }, [pathname, recordActivity, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    const updateRemaining = () => {
      setInactivityRemainingMs(Math.max(config.inactivityTimeoutMs - (Date.now() - lastActivityAt), 0));
    };

    updateRemaining();

    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityAt;
      const remainingMs = config.inactivityTimeoutMs - idleMs;

      if (remainingMs <= 0) {
        void logout();
        return;
      }

      setShowInactivityWarning(remainingMs <= config.inactivityWarningMs);
    }, 1000);

    const displayTimer = window.setInterval(updateRemaining, INACTIVITY_DISPLAY_UPDATE_MS);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(displayTimer);
      setInactivityRemainingMs(null);
    };
  }, [config.inactivityTimeoutMs, config.inactivityWarningMs, lastActivityAt, logout, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      setAccessTokenExpiresInMs(null);
      return;
    }

    const updateExpiry = () => {
      const expiresAtSeconds = keycloakRef.current?.tokenParsed?.exp;

      if (!expiresAtSeconds) {
        setAccessTokenExpiresInMs(null);
        return;
      }

      setAccessTokenExpiresInMs(Math.max(expiresAtSeconds * 1000 - Date.now(), 0));
    };

    updateExpiry();
    const timer = window.setInterval(updateExpiry, INACTIVITY_DISPLAY_UPDATE_MS);

    return () => {
      window.clearInterval(timer);
      setAccessTokenExpiresInMs(null);
    };
  }, [lastTokenRefresh, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let refreshInProgress = false;

    const timer = window.setInterval(() => {
      const keycloak = keycloakRef.current;

      if (!keycloak?.authenticated || refreshInProgress) {
        return;
      }

      refreshInProgress = true;
      keycloak
        .updateToken(TOKEN_REFRESH_LEEWAY_SECONDS)
        .then((refreshed) => {
          syncTokenSnapshot();

          if (refreshed) {
            setLastTokenRefresh({
              refreshedAt: new Date().toLocaleTimeString(),
              source: "background"
            });
          }
        })
        .catch((refreshError) => {
          setError(formatAuthError(refreshError));
          void login();
        })
        .finally(() => {
          refreshInProgress = false;
        });
    }, BACKGROUND_TOKEN_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [login, status, syncTokenSnapshot]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      initialized: status !== "initializing",
      authenticated: status === "authenticated",
      user,
      authorizationClaims,
      authorizationTokenMocked: config.mockAuthorizationToken,
      tokens,
      inactivityRemainingMs,
      accessTokenExpiresInMs,
      lastTokenRefresh,
      error,
      login,
      logout,
      getAccessToken,
      getAuthorizationToken,
      ensureValidAccessToken,
      ensureValidAuthorizationToken,
      authenticatedFetch,
      recordActivity
    }),
    [
      authenticatedFetch,
      accessTokenExpiresInMs,
      authorizationClaims,
      config.mockAuthorizationToken,
      ensureValidAccessToken,
      ensureValidAuthorizationToken,
      error,
      getAccessToken,
      getAuthorizationToken,
      inactivityRemainingMs,
      lastTokenRefresh,
      login,
      logout,
      recordActivity,
      status,
      tokens,
      user
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showInactivityWarning && status === "authenticated" && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="session-warning-title">
            <h2 id="session-warning-title">Session expires soon</h2>
            <p>Your session is about to expire because of inactivity.</p>
            <button onClick={recordActivity}>Stay signed in</button>
          </section>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}

function getProfile(parsedToken?: KeycloakTokenParsed): UserProfile {
  if (!parsedToken) {
    return {};
  }

  return {
    subject: parsedToken.sub,
    preferredUsername: parsedToken.preferred_username,
    name: parsedToken.name,
    givenName: parsedToken.given_name,
    familyName: parsedToken.family_name,
    email: parsedToken.email,
    nucleus: parsedToken.nucleus,
    organization: parsedToken.organization
  };
}
