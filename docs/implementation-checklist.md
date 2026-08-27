# Implementation Checklist

This checklist tracks the work required to turn this repository into a reusable reference implementation for Polyphonic Next.js App Router frontend authentication.

## Decisions Captured

- [x] Target applications use Next.js App Router.
- [x] This repository should become a reusable reference implementation.
- [x] No SSO session means the frontend redirects to hosted Keycloak login.
- [x] Default/example inactivity timeout is 15 minutes and remains environment-configurable.
- [x] Inactivity logout warns the user shortly before timeout.
- [x] Login redirect URI pattern is `${root-url}/signin`.
- [x] Logout redirect URI pattern is `${root-url}/`.
- [x] Silent SSO URI pattern is `${root-url}/sso-signin`.
- [x] Current Chrome, Safari, and Microsoft Edge must be supported.
- [x] SSR authenticated API calls are out of scope.
- [x] Keycloak application-access role is internally named `access` and is not used by frontend code.
- [x] Polyphonic authorization token is requested from TMSv2 via `POST ${tms-v2-root-url}/api/v2/token`.
- [x] Polyphonic authorization token is returned in the `X-Authorization` response header.
- [x] Polyphonic authorization token claims are `app`, `tnt`, and `roles`.
- [x] TMSv2 authorization-token request supports optional `tenantId` query parameter.
- [x] Authorization-token requests can be mocked when TMSv2 is unavailable in local/test environments.
- [x] Inactivity warning lead time starts at 60 seconds before timeout and remains configurable.
- [x] TMSv2 token retrieval failure displays an access-denied screen.
- [x] Missing or malformed `X-Authorization` response header displays an access-denied screen.
- [x] Polyphonic authorization token has an `exp` claim and is refreshed at least 30 seconds before expiry.
- [x] TMSv2 authorization tokens are tenant- and application-scoped and tied to the Keycloak access-token lifetime.
- [x] Next.js public browser configuration is read server-side from environment variables and passed into the client auth boundary as serializable non-secret config.
- [x] The reference implementation starts as app-local source, not an npm package.

## Build Checklist

- [x] Replace the Vite playground with, or add alongside it, a Next.js App Router reference application.
- [x] Create a browser-only `AuthProvider` Client Component using `'use client'`.
- [x] Keep all direct `keycloak-js` imports inside the authentication implementation.
- [x] Expose an auth context/hook for application components.
- [x] Model auth states explicitly: initializing, authenticated, unauthenticated, access denied, error, logging out.
- [x] Initialize Keycloak with Authorization Code Flow and PKCE `S256`.
- [x] Run `check-sso` on startup, then call `login()` automatically if no SSO session is available.
- [x] Treat `login_required` and `interaction_required` from SSO checks as no-session results that trigger hosted login.
- [x] Add `/signin` handling for login redirects.
- [x] Add `/sso-signin` handling for silent SSO redirects.
- [x] Configure logout with post-logout redirect to `${root-url}/`.
- [x] Ensure protected content is not rendered before authentication initialization completes.
- [x] Implement `ensureValidAccessToken()` using `keycloak.updateToken(30)`.
- [x] Implement `getAuthorizationToken()` against `POST ${tms-v2-root-url}/api/v2/token`.
- [x] Support optional `tenantId` query parameter for TMSv2 authorization-token retrieval.
- [x] Extract the TMSv2 authorization JWT from the `X-Authorization` response header.
- [x] Add configurable mock authorization-token mode for local/test environments without TMSv2.
- [x] Generate mock authorization-token claims for `app`, `tnt`, `roles`, and `exp`.
- [x] Display an access-denied screen when TMSv2 token retrieval fails.
- [x] Display an access-denied screen when `X-Authorization` is absent or malformed.
- [x] Refresh the Polyphonic authorization token at least 30 seconds before its `exp` value.
- [x] Keep Keycloak tokens and the Polyphonic authorization token in memory only.
- [x] Show the current access token in the reference UI.
- [x] Show the current ID token in the reference UI.
- [x] Show the current refresh token in the reference UI.
- [x] Display token tiles as decoded JWT header/payload JSON.
- [x] Show access-token expiry countdown in the reference UI.
- [x] Update displayed access-token expiry countdown every 5 seconds.
- [x] Show background token refresh timestamp/source in the reference UI.
- [x] Use a compact diagnostic layout with dense status/config grids.
- [x] Keep long token values inside fixed-height scroll areas.
- [x] Implement a centralized browser API client that sends `Authorization` and `X-Authorization`.
- [x] Decode the Polyphonic authorization token for frontend convenience claims where needed.
- [x] Derive profile information from the ID token.
- [x] Include `name`, `given_name`, and `family_name` in the displayed profile.
- [x] Mark authorization claims as mocked when mock authorization-token mode is enabled.
- [x] Do not parse Keycloak `resource_access` in frontend authorization logic.
- [x] Implement configurable inactivity timeout.
- [x] Show inactivity timeout countdown in the reference UI.
- [x] Update displayed inactivity countdown every 5 seconds.
- [x] Track only intentional user activity: keyboard, mouse/pointer, touch, navigation, and equivalent user interactions.
- [x] Exclude token refreshes, polling, timers, WebSocket traffic, and background API calls from activity tracking.
- [x] Add a session-expiration warning dialog before inactivity logout.
- [x] Use 60 seconds as the default inactivity warning lead time.
- [x] Let the warning dialog extend the session by recording user activity.
- [x] Coordinate activity between same-origin tabs/windows using activity timestamps only.
- [x] Do not store or broadcast OAuth tokens or authorization tokens.
- [x] Make explicit logout and inactivity logout use the same centralized logout path.
- [x] Add access-denied behavior for failed application-access checks.
- [x] Externalize all IAM, TMSv2, redirect, silent SSO, and inactivity settings.
- [x] Make iframe-based silent SSO configurable and disabled by default for local/test reliability.
- [x] Externalize mock authorization-token settings.
- [x] Read public Next.js runtime configuration from server-side environment variables.
- [x] Pass only serializable non-secret public configuration into the browser auth boundary.
- [x] Keep the reference implementation as app-local source.

## Validation Checklist

- [x] Verify no application code writes tokens to `localStorage`.
- [x] Verify no application code writes tokens to `sessionStorage`.
- [x] Verify no application code writes tokens to IndexedDB.
- [x] Verify no token values are sent through `BroadcastChannel`.
- [ ] Test initial login with no SSO session.
- [ ] Test page reload with an existing Keycloak SSO session.
- [ ] Test opening a new tab with an existing Keycloak SSO session.
- [ ] Test SSO into a second Polyphonic application/client.
- [ ] Test denied application access with an existing SSO session.
- [ ] Test access-token refresh before API calls.
- [ ] Test refresh failure and re-authentication/logout behavior.
- [ ] Test TMSv2 authorization-token retrieval and missing `X-Authorization` header behavior.
- [ ] Test mock authorization-token mode without a TMSv2 backend.
- [ ] Verify TMSv2 CORS allows `Authorization` and exposes `X-Authorization` when TMSv2 is cross-origin.
- [ ] Test inactivity timeout logout.
- [ ] Test inactivity warning extension.
- [ ] Test same-origin multi-tab activity coordination.
- [ ] Test silent SSO behavior in current Chrome.
- [ ] Test silent SSO behavior in current Safari.
- [ ] Test silent SSO behavior in current Microsoft Edge.

## Remaining Details To Define

- [x] Exact inactivity warning lead time: start with 60 seconds before timeout and keep it configurable.
- [x] Expected behavior when TMSv2 token retrieval fails: display an access-denied screen.
- [x] Expected behavior when the `X-Authorization` response header is absent or malformed: display an access-denied screen.
- [x] Polyphonic authorization-token expiry and refresh behavior: token has `exp` and shall be refreshed at least 30 seconds before expiry.
- [x] TMSv2 authorization-token scope/lifetime: tenant- and application-scoped, and tied to the Keycloak access-token lifetime.
- [x] Public runtime configuration delivery for Next.js: read server-side environment variables and pass serializable non-secret config into the client auth boundary.
- [x] Reference implementation packaging: start with app-local source, not an npm package.
