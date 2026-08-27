"use client";

import { useState } from "react";
import { useAuth } from "@/src/auth/AuthProvider";
import type { PublicAuthConfig } from "@/src/auth/types";

export function AuthStatusPanel({ config }: { config: PublicAuthConfig }) {
  const auth = useAuth();
  const [tokenCheckResult, setTokenCheckResult] = useState<string | null>(null);

  async function refreshTokens() {
    setTokenCheckResult(null);
    await auth.ensureValidAccessToken();
    await auth.ensureValidAuthorizationToken();
    setTokenCheckResult(new Date().toLocaleTimeString());
  }

  return (
    <Shell
      title="Polyphonic IAM Client Reference"
      subtitle="Next.js App Router reference implementation for Keycloak and Polyphonic authorization tokens."
    >
      <section className="panel">
        <div>
          <p className="label">Connection</p>
          <h2>{getStatusLabel(auth.status)}</h2>
          <dl className="details">
            <div>
              <dt>Keycloak URL</dt>
              <dd>{config.keycloakUrl}</dd>
            </div>
            <div>
              <dt>Realm</dt>
              <dd>{config.realm}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{config.clientId}</dd>
            </div>
            <div>
              <dt>Redirect URI</dt>
              <dd>{config.redirectUri}</dd>
            </div>
            <div>
              <dt>Silent SSO URI</dt>
              <dd>{config.silentCheckSsoRedirectUri}</dd>
            </div>
            <div>
              <dt>TMSv2 URL</dt>
              <dd>{config.tmsV2RootUrl}</dd>
            </div>
            <div>
              <dt>Authorization Mode</dt>
              <dd>{config.mockAuthorizationToken ? "mock" : "TMSv2"}</dd>
            </div>
            <div>
              <dt>Tenant</dt>
              <dd>{config.tenantId ?? "default"}</dd>
            </div>
          </dl>
        </div>
        <div className="actions">
          {auth.status === "authenticated" && (
            <>
              <button onClick={refreshTokens} className="secondary">
                Refresh tokens
              </button>
              <button onClick={auth.logout}>Sign out</button>
            </>
          )}
          {(auth.status === "access-denied" || auth.status === "error") && <button onClick={auth.login}>Sign in</button>}
        </div>
      </section>

      {auth.error && <p className="error">{auth.error}</p>}
      {tokenCheckResult && <p className="success">Token validation completed at {tokenCheckResult}</p>}

      {auth.status === "authenticated" && (
        <section className="grid">
          <TokenCard title="Profile" value={auth.user} />
          <TokenCard title="Authorization Claims" value={auth.authorizationClaims} />
          <TokenCard
            title="Session Policy"
            value={{
              inactivityTimeoutMs: config.inactivityTimeoutMs,
              inactivityWarningMs: config.inactivityWarningMs,
              tokenRefreshLeewaySeconds: 30
            }}
          />
        </section>
      )}

      {auth.status === "access-denied" && (
        <section className="panel">
          <div>
            <p className="label">Access denied</p>
            <h2>Application authorization is unavailable</h2>
          </div>
        </section>
      )}
    </Shell>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <main>
      <header>
        <p className="eyebrow">Polyphonic IAM</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      {children}
    </main>
  );
}

function TokenCard({ title, value }: { title: string; value: unknown }) {
  return (
    <article className="token-card">
      <h2>{title}</h2>
      <pre>{JSON.stringify(value ?? null, null, 2)}</pre>
    </article>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "initializing":
      return "Initializing authentication";
    case "authenticated":
      return "Authenticated";
    case "unauthenticated":
      return "Redirecting to sign in";
    case "access-denied":
      return "Access denied";
    case "logging-out":
      return "Signing out";
    default:
      return "Authentication error";
  }
}
