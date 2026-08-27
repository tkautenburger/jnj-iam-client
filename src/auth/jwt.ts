import type { AuthorizationClaims } from "./types";

type JwtPayload = Record<string, unknown>;

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

function encodeBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Authorization token is not a JWT");
  }

  return JSON.parse(decodeBase64Url(parts[1])) as JwtPayload;
}

export function decodeJwt(token: string): { header: JwtPayload; payload: JwtPayload } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Token is not a JWT");
  }

  return {
    header: JSON.parse(decodeBase64Url(parts[0])) as JwtPayload,
    payload: JSON.parse(decodeBase64Url(parts[1])) as JwtPayload
  };
}

export function tryDecodeJwt(token?: string): { header: JwtPayload; payload: JwtPayload } | null {
  if (!token) {
    return null;
  }

  try {
    return decodeJwt(token);
  } catch {
    return null;
  }
}

export function normalizeAuthorizationToken(headerValue: string): string {
  const value = headerValue.trim();

  if (value.split(".").length === 3) {
    return value;
  }

  const decoded = atob(value);
  if (decoded.split(".").length !== 3) {
    throw new Error("Authorization header is not a JWT or Base64-encoded JWT");
  }

  return decoded;
}

export function readAuthorizationClaims(token: string): AuthorizationClaims {
  const payload = decodeJwtPayload(token);
  const app = payload.app;
  const tnt = payload.tnt;
  const roles = payload.roles;
  const exp = payload.exp;

  if (typeof app !== "string" || typeof tnt !== "string" || !Array.isArray(roles) || typeof exp !== "number") {
    throw new Error("Authorization token is missing required claims");
  }

  if (!roles.every((role) => typeof role === "string")) {
    throw new Error("Authorization token roles claim is malformed");
  }

  return {
    app,
    tnt,
    roles,
    exp
  };
}

export function expiresWithin(claims: AuthorizationClaims, seconds: number): boolean {
  return claims.exp - Math.floor(Date.now() / 1000) <= seconds;
}

export function createMockAuthorizationToken(claims: AuthorizationClaims): string {
  const header = {
    alg: "none",
    typ: "JWT"
  };

  return `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(claims))}.`;
}
