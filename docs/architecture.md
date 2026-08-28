# Polyphonic IAM - Frontend Authentication Refactoring

## Problem Statement

The existing Polyphonic frontend applications are implemented using React and Next.js App Router and are integrated with Okta IAM using the Okta Sign-In Widget, the Okta JavaScript SDK, and Okta's Interaction Code Grant. Authentication is therefore coupled to Okta-specific frontend components, APIs, token handling, and authentication flows.

As part of the migration from Okta to Keycloak, the applications must be refactored to use the `keycloak-js` client adapter and the standard OpenID Connect Authorization Code Flow with PKCE. Authentication shall be performed using the centrally hosted Keycloak login experience rather than an authentication widget embedded in the application.

The target solution must preserve Polyphonic-specific application-access semantics and web SSO behavior. A successfully authenticated user may access a Polyphonic application only if a valid bearer token for targeted application client is presented.

The current Okta implementation persists authentication tokens in the browser's `localStorage`, allowing authentication state to survive page reloads and to be reused across browser tabs of the same origin. Persisting authentication tokens in the Browser's localStorage shall be avoided because any JavaScript executing within the application origin, including code introduced through an XSS vulnerability, can access and exfiltrate these bearer tokens, while persistence also extends their exposure across page reloads and browser tabs.

Because the applications use Next.js App Router, the solution must also clearly separate browser-side authentication logic from server-rendered execution. The `keycloak-js` client is a browser adapter and shall only be used on the client side.

This project shall serve as guideline and reference implementation for Polyphonic frontend applications.

## Objectives

The refactoring shall:

- replace the Okta Sign-In Widget and Okta JavaScript SDK with `keycloak-js`;
- replace the proprietary Okta Interaction Code Grant with standard Authorization Code Flow with PKCE (`S256`);
- move interactive authentication completely to custom-styled Keycloak-hosted login pages;
- support seamless SSO between Polyphonic web applications;
- use non-interactive OIDC authentication when an existing Keycloak SSO session is available;
- support short-lived access tokens and their automated renewal without unnecessary user interaction;
- automatically log users out after a configurable period of frontend inactivity;
- centralize authentication behavior behind a reusable application authentication abstraction;
- isolate browser-only authentication behavior from Next.js server-side rendering and Server Components;
- minimize direct Keycloak dependencies in application business components;
- avoid unnecessary and insecure persistent browser storage of access tokens, and refresh tokens.

## Requirements

### OIDC Client and Authentication Flow

Each React / Next.js frontend shall be configured as a **public OpenID Connect client** in Keycloak.

The client shall use:

- Authorization Code Flow;
- PKCE with `S256`;
- no client secret;
- no Implicit Flow;
- no Direct Access Grant / Resource Owner Password flow.

Authentication shall be initiated through the `keycloak-js` client and performed using redirection to Keycloak-hosted authentication pages. The customization of Keycloak-hosted authentication pages to preserve the application's look and feel during login is not in scope of this project.

### Next.js Client-Side Authentication Boundary

The `keycloak-js` client shall only execute in the browser. The Keycloak instance, authentication provider, token lifecycle management, inactivity tracking, and browser SSO checks shall therefore be implemented within a Next.js Client Component boundary using `'use client'`.

The authentication implementation shall not access browser-only APIs such as `window`, `document`, or `sessionStorage` during server-side rendering.

Protected frontend content shall not be rendered until authentication initialization has completed. The application shall expose an explicit initialization state to prevent protected content from being displayed before the authentication state is known.

### Application Access Enforcement

Authentication to a Polyphonic application requires explicit access to the target application. A user shall receive a token for a requesting application only when the Polyphonic application-access role associated with that OIDC client has been assigned through the Polyphonic authorization model. This provides Okta-like application assignment semantics: Authentication to the Polyphonic realm does not automatically authorize access to every Polyphonic application.

The application-access check shall be executed for every interactive or SSO-based browser authentication that results in tokens for the requesting client. In particular, an existing Keycloak SSO session or successful cookie authentication shall not bypass the application-access check. If the user has no access to the requesting application, authentication for that client shall be rejected and no application token shall be issued.

This behavior is ensured by the customized Keycloak authentication flows and is transparent to the web application. The general rule for the web application and its authentication process is: "If i receive an access token, the user is eligible to access the application".

### Token Claims

Access tokens issued to normal Polyphonic applications do not expose Keycloak's standard `resource_access` claim. Application-specific authorization information required by frontend or backend services is exposed through the Polyphonic authorization token instead. Frontend applications shall therefore not depend on parsing the `resource_access` claim for authorization decisions. Those claims are reserved for Keycloak web console applications only (account console, admin console).

The Polyphonic authorization token is issued by the TMSv2 backend and contains the authorization model used by frontend and backend services, including the following claims:

- `app`: the authorized application identifier;
- `tnt`: the tenant identifier for the user;
- `roles`: the application roles assigned to the user in scope of the authorized application and tenant.

### Web SSO Between Polyphonic Applications

All participating Polyphonic web applications within a dedicated Polyphonic environment shall use the same Keycloak realm and browser SSO session. When a user opens another Polyphonic web application, the target application shall first attempt non-interactive OIDC authentication using the existing Keycloak SSO session. This shall be implemented using `keycloak-js` `check-sso` behavior and, where supported, silent `check-sso`.

Conceptually, the authentication flow can be described like this:

```text
Application A
    |
    | user opens Application B
    v
Application B
    |
    | check-sso / non-interactive authorization
    v
Keycloak
    |
    +-- SSO session + access to App B
    |      |
    |      v
    |   issue authorization response and App B token set
    |
    +-- SSO session + no access to App B
    |      |
    |      v
    |   deny access; no App B token issued
    |
    +-- no usable SSO session
           |
           v
       return unauthenticated
           |
           v
       application B initiates interactive login
```

The `check-sso` authentication method itself shall not force an interactive login. Polyphonic frontend applications are treated as protected applications by default. If no usable SSO session exists, the application shall invoke `keycloak.login()` and redirect the user to the hosted Keycloak login page for the targeted application. The reference implementation uses Keycloak's `login-required` startup mode for the protected reference app so startup always goes through the Keycloak authorization flow and can reuse an existing Keycloak SSO session when the browser still has a valid Keycloak session cookie.

With `login-required`, navigation through the Keycloak authorization endpoint on application startup is expected. Successful SSO restoration means Keycloak immediately redirects back to the application without asking for credentials. If the browser remains on the hosted login form, the Keycloak SSO cookie was not available, not sent, expired, or not accepted for the configured Keycloak origin.

Keycloak documents `check-sso` as authenticating only when an existing Keycloak login is available. Silent `check-sso` can avoid a visible full-page redirect by using `silentCheckSsoRedirectUri`, but it is subject to modern browser third-party-cookie restrictions.

The reference implementation makes silent SSO configurable and disables it by default for local/test reliability. If Keycloak returns a `login_required` or `interaction_required` result from a non-interactive SSO check, the frontend shall treat that as "no usable SSO session" and start the normal hosted login flow instead of rendering an authentication error.

Each application shall receive a token set issued specifically for its own OIDC client. Tokens shall never be copied, shared, or transferred between Polyphonic applications.

Embedded Keycloak login pages (Iframes) should not be used. Interactive authentication shall use redirect-based OIDC authentication and a Polyphonic Keycloak theme for consistent branding. Iframes are limited to Keycloak-supported non-interactive SSO/session-check mechanisms.

### Inactivity Logout

Each Polyphonic frontend shall implement a configurable **application inactivity timeout**. ISRM IAPPs mandate an inactivity timeout of 15 minutes or less. The timeout is based on intentional user interaction with the frontend, not on technical activity or protocol interactions with the Keycloak instance.

Activity that may reset the timer includes:

- keyboard input;
- mouse or pointer interaction;
- touch interaction;
- application navigation;
- other intentional user interaction with the application.

Background API calls, token refreshes, timers, polling, WebSocket traffic, and other technical activity shall **not** reset the inactivity timer. When the configured inactivity timeout expires, the application shall initiate a Keycloak logout rather than only clearing local authentication state.

The logout shall:

1. terminate the user's Keycloak SSO session;
2. clear the frontend authentication state;
3. prevent further token renewal;
4. redirect the browser to the configured post-logout location.

Because this logout terminates the shared Keycloak SSO session, it affects **all Polyphonic applications** using that session, e.g. a user having the Polyphonic Surgery web application and the Keycloak Account Console open at the same and logs out in one of the applications, also logs out the other application, because Keycloak SSO session does no longer exist.

For multiple tabs or windows of the same application, user activity shall be coordinated so that an inactive background tab does not terminate the SSO session while the user is actively using another tab. Only the activity timestamp/state may be synchronized between browser contexts; OAuth tokens shall remain memory-only and shall not be shared through browser storage.

Explicit logout and inactivity logout shall also be coordinated between same-origin tabs/windows. When one tab starts logout, it shall broadcast a logout event without token data. Other open tabs of the same application shall receive that event and invoke the same centralized Keycloak logout path.

If Polyphonic applications are hosted on different origins and inactivity is intended to be evaluated across applications rather than independently per application, a separate cross-application activity coordination mechanism is required and must be defined explicitly. Cross-application activity coordination is not in scope of this project.

The inactivity timeout shall be externally configurable per deployment environment. The reference implementation shall use 15 minutes as its default value to comply with JnJ security requirements.

The user shall be warned shortly before the inactivity timeout expires. The reference implementation shall use 60 seconds before timeout as its example/default warning lead time, and this value shall be externally configurable. The warning shall be displayed as an application dialog with an explicit action that records user activity and extends the session. If the user does not react before the timeout expires, the application shall initiate Keycloak logout.

The reference application shall display the inactivity timeout countdown and update that displayed value every 5 seconds. Protocol activity such as background token refresh must not alter this countdown.

### Token Lifecycle

Access and refresh tokens shall remain under the control of the `keycloak-js` client and **shall remain in browser memory**. They shall not be persisted to `localStorage`, `sessionStorage`, IndexedDB, or another application-managed persistent browser store.

Before protected API calls, the centralized API/authentication layer shall ensure that the access token has sufficient remaining validity, for example:

```javascript
await keycloak.updateToken(30);
```

Failure to refresh a token shall transition the application into an unauthenticated state and trigger the defined re-authentication or logout behavior.

The reference application includes a diagnostic token view for local validation. It displays the current access token and ID token as decoded read-only debug output, and it records the last successful token refresh with the refresh source (`background`, `api`, or `manual`). When TMSv2 mode is active, it also displays the Polyphonic authorization token as decoded read-only debug output. When mock authorization-token mode is active, the top status panel marks authorization as mocked and the mocked authorization token is not displayed as a token tile. The refresh token itself is not displayed; the top status panel shows only whether a refresh token is currently present.

This diagnostic display is part of the reference/test surface and must not be copied into normal production business screens.

![](/Users/tkautenb/Library/Application%20Support/marktext/images/2026-08-28-11-35-12-image.png)

The reference implementation performs a background token-validity check every 5 seconds by calling `keycloak.updateToken(30)`. This does not reset the inactivity timer. If Keycloak actually refreshes the token, the token snapshot and refresh timestamp are updated in the diagnostic UI. The UI also displays the access-token expiry countdown and update it every 5 seconds.

The existing Okta implementation stores authentication tokens in `localStorage`. The Keycloak implementation intentionally changes this behavior:

- a page reload starts a new `keycloak-js` instance without persisted application tokens;
- a newly opened tab or window starts without shared application tokens;
- authentication state is re-established through the existing Keycloak SSO session using protected-app startup authentication such as `login-required`, or optional `check-sso` / non-interactive OIDC authentication for applications that support an unauthenticated initial state;
- each browser context receives and manages its own token set;
- access, refresh, and ID tokens shall not be directly written to browser storage by the application.

This change reduces persistent browser exposure of bearer tokens and aligns with the documented `keycloak-js` token-storage model.

### API Authentication

Browser-originated calls to protected Polyphonic backend APIs shall use the Keycloak access token and the previously obtained Polyphonic authorization token:

```text
Authorization: Bearer <access-token>
X-Authorization: <authorization-token>
```

Backend services remain responsible for token validation and authorization enforcement. Frontend route protection, feature/capability controls, and UI authorization controls are convenience and user-experience controls only and must not replace backend authorization. The Polyphonic authorization token shall be requested from the TMSv2 backend service:

```text
POST ${tms-v2-root-url}/api/v2/token[?tenantId=<tenantId>]
Authorization: Bearer <access-token>
```

The response provides the Base64-encoded authorization JWT token in the `X-Authorization` HTTP response header. The frontend authentication/API layer shall extract this header value, keep it in memory, and attach it to subsequent protected Polyphonic API calls as `X-Authorization` HTTP header.

If the TMSv2 token request fails, or if the `X-Authorization` response header is absent or malformed, the frontend shall transition to an access-denied state and display an access-denied screen.

The Polyphonic authorization token contains an `exp` claim. The frontend shall refresh the authorization token at least 30 seconds before expiry. The TMSv2 authorization token is tenant- and application-scoped and is tied to the Keycloak access-token lifetime.

For local and test environments where TMSv2 is not available, the reference implementation supports a configurable mock authorization-token mode. Mock mode generates an in-memory JWT-shaped token with the same frontend claims (`app`, `tnt`, `roles`, `exp`) and bypasses the TMSv2 HTTP request. The mock token is unsigned and exists only to exercise frontend behavior; it must not be treated as a production authorization artifact and must not be accepted by real backend services.

When mock authorization-token mode is enabled, the reference UI explicitly marks the authorization mode as mocked and does not display the mocked authorization token as a diagnostic token tile.

Reference implementation:

```ts
if (!cachedToken || expiresWithin(cachedToken.claims, 30)) {
  await requestAuthorizationToken();
}
```

### Server-Side Next.js Processing

A token managed by `keycloak-js` in the browser is not automatically available to:

- Next.js Server Components;
- Server Actions;
- Route Handlers;
- API routes executed server-side;
- SSR data-fetching logic.

Authenticated Polyphonic API calls from SSR, Server Components, Server Actions, Route Handlers, and server-side API routes are explicitly out of scope for this reference implementation. Authenticated Polyphonic API calls are assumed to be performed from the browser.

## Solution Design

### Target Architecture

The following diagram shows an overview of the authentication and authorization process flow for Polyphonic web applications.

```
+---------------------------------------------------+
| Next.js Application                               |
|                                                   |
|  Server Components / SSR                          |
|  - no direct keycloak-js usage                    |
|  - no browser token access                        |
|                                                   |
|  +---------------------------------------------+  |
|  | Client Authentication Boundary              |  |
|  | 'use client'                                |  |
|  |                                             |  |
|  | AuthProvider                                |  |
|  |      |                                      |  |
|  |      v                                      |  |
|  | keycloak-js                                 |  |
|  |      |                                      |  |
|  |      +-- Token Lifecycle                    |  |
|  |      +-- SSO Check                          |  |
|  |      +-- Inactivity Manager                 |  |
|  |      +-- Browser API Client                 |  |
|  +------|--------------------------------------+  |
+---------|-----------------------------------------+
          |
          | Authorization Code + PKCE
          v
+---------------------------------------------------+
| Keycloak                                          |
|                                                   |
| Browser Authentication                            |
| Application Access Gate                           |
| SSO Session                                       |
+---------------------------------------------------+
          |
          | Bearer Access Token
          v
+---------------------------------------------------+
| Polyphonic Authorization Token API                |
+---------------------------------------------------+
          |
          | Bearer Access Token + Authorization Token
          v
+---------------------------------------------------+
| Polyphonic Backend APIs                           |
+---------------------------------------------------+
```

### Authentication Abstraction

Direct use of the `keycloak-js` client shall be concentrated in a dedicated authentication module. The application should expose an abstraction similar to:

```
AuthProvider
 ├── initialized
 ├── authenticated
 ├── user
 ├── login()
 ├── logout()
 ├── getAccessToken()
 ├── getAuthorizationToken()
 ├── ensureValidAccessToken()
 ├── ensureValidAuthorizationToken()
 └── authentication/session events
```

React business components shall depend on this abstraction rather than importing the `keycloak-js` client directly. This isolates IAM-specific behavior and simplifies testing and future IAM changes.

User profile data exposed by the reference authentication abstraction is derived from the ID token, not the access token. The reference profile includes `sub`, `preferred_username`, `name`, `given_name`, `family_name`, `email`, and any relevant Polyphonic claims such as `nucleus`.

### Next.js Client Integration

The authentication provider shall be implemented as a Client Component.

Conceptually:

```ts
'use client';

export function AuthProvider({ children }) {
  // initialize and manage keycloak-js here
}
```

The Keycloak instance should be created only in browser-executed code. Authentication-dependent components shall consume the application authentication context rather than accessing Keycloak directly.

Reference implementation:

```ts
'use client';

export function AuthProvider({ config, children }) {
  const keycloakRef = useRef<Keycloak | null>(null);
  // initialize and manage keycloak-js here
}
```

Server Components pass only serializable public configuration into this boundary:

```ts
export default function HomePage() {
  return <ReferenceApp config={getPublicAuthConfig()} />;
}
```

### Application Initialization

The Keycloak adapter shall be initialized after the application has entered the browser execution context. For optional SSO discovery without immediate interactive login, the initialization pattern is:

```ts
await keycloak.init({
  onLoad: 'check-sso',
  pkceMethod: 'S256',
  silentCheckSsoRedirectUri:
    config.silentCheckSsoRedirectUri
});
```

While initialization is in progress, protected application content shall not be displayed. If no valid SSO session exists, the frontend shall explicitly invoke:

```ts
await keycloak.login();
```

Applications that exclusively contain authenticated functionality, display or process sensitive data, or operate in environments with shared workstations shall use `login-required`. The reference implementation uses this mode because the application is protected by default. This does not persist application authentication state and does not create an SSO session by itself. It only asks Keycloak to authenticate immediately; Keycloak can complete that request without showing the login form only when the browser sends a valid Keycloak SSO cookie for the configured Keycloak origin.

Reference implementation:

```ts
const authenticated = await keycloak.init({
  onLoad: 'login-required',
  pkceMethod: 'S256',
  redirectUri: config.redirectUri,
  scope: config.scope
});
```

### Silent SSO Resource

The Next.js application shall expose the silent SSO callback resource at a stable URL. The reference URI pattern is:

```
${application-root-url}/sso-signin
```

Silent `check-sso` is an optimization and must not be treated as universally available because browser privacy controls may restrict third-party iframe cookies. The default Keycloak adapter behavior may fall back to regular `check-sso`, which can involve a full browser redirect. The implementation and test strategy shall cover current Chrome, Safari, and Microsoft Edge behavior.

Reference implementation:

```ts
export function GET() {
  return new Response(`
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  `);
}
```

### Cross-Application SSO

When the user opens another Polyphonic frontend:

1. the target application initializes its browser authentication layer;
2. `keycloak-js` checks whether an existing Keycloak SSO session can be reused;
3. Keycloak evaluates the requesting OIDC client;
4. the Polyphonic application-access authenticator verifies that the user has access to the target application;
5. if both SSO and application access are valid, the target application receives its own authorization response and tokens without prompting for credentials;
6. if the user has no target application access, authentication is denied;
7. if no valid SSO session exists, interactive login is initiated.

This preserves SSO without weakening application-specific access enforcement.

### Inactivity Manager

A dedicated browser-side inactivity manager shall track intentional user activity.

The inactivity timeout is evaluated independently by each Polyphonic frontend application. User activity in other Polyphonic applications does not reset the application's inactivity timer, and no cross-application inactivity synchronization is implemented. When the inactivity timeout of an application expires, the application initiates Keycloak logout, thereby terminating the shared Keycloak SSO session and consequently logging the user out of other Polyphonic applications as well.

For multiple tabs or windows of the same application, user activity shall be coordinated so that an inactive background tab does not trigger logout while the user is actively using the same application in another tab or window. Only activity state shall be synchronized; authentication tokens must remain memory-only and must not be shared between browser contexts.

Logout shall also be coordinated between same-origin tabs/windows by broadcasting only a logout event. Other tabs shall react by invoking the centralized logout function; no token data shall be broadcast.

Conceptually:

```
Same application
Tab A <---- activity sync ----> Tab B
              |
         inactivity timer
              |
              v
        Keycloak logout


Different applications
App A                    App B
  |                        |
own timer              own timer
  |                        |
  +--- NO activity sync ---+

Whichever application reaches its
inactivity timeout first:
              |
              v
        Keycloak logout
              |
              v
      Shared SSO terminated
```

The inactivity manager shall be implemented inside the client authentication boundary and shall register browser event listeners only after hydration. The inactivity timer is independent from token refresh and Keycloak server-side session timeouts.

```
Access Token Lifetime
    -> lifetime of an individual access token

Keycloak SSO Session Timeout
    -> server-side IAM session lifetime, typically 2 or 3 times the token lifetime

Frontend Inactivity Timeout
    -> application policy based on actual user interaction, default 15 minutes
```

The effective session terminates when the first applicable termination condition is reached.

For same-origin tabs/windows, an activity-coordination mechanism such as `BroadcastChannel` may be used to propagate only the latest user-activity timestamp. Access and refresh tokens shall not be broadcast or stored for this purpose.

If applications run on different origins, browser-native same-origin coordination mechanisms do not provide a shared activity state.

Reference implementation:

```ts
const channel = new BroadcastChannel('polyphonic-iam-activity');

function recordActivity() {
  channel.postMessage({ type: 'activity', timestamp: Date.now() });
}
```

### API Client

Browser-side API token handling shall be centralized in the application's HTTP client. The inclusion of the TMSv2 authorization token handling is recommended. Individual React components shall not manage token renewal.

Reference implementation:

```ts
async function authenticatedFetch(input, init = {}) {
  const accessToken = await ensureValidAccessToken();
  const authorizationToken = await ensureValidAuthorizationToken();
  const headers = new Headers(init.headers);

  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('X-Authorization', authorizationToken);

  return fetch(input, { ...init, headers });
}
```

Before a protected request:

```
API request
    |
    v
ensureValidAccessToken()
    |
    +-- refresh required --> getAccessToken()
    |                           |
    |                           +-- failure --> authentication failure
    v
ensureValidAuthorizationToken()
    |
    +-- refresh required --> getAuthorizationToken()
    |                           |
    |                           +-- failure --> authorization failure
    v
send API request
```

### Logout

Explicit user logout and inactivity logout shall use the same centralized logout mechanism. The logout implementation shall invoke Keycloak logout and use an explicitly configured post-logout redirect URI. Clearing only the application's local authentication state is insufficient because the Keycloak SSO session would otherwise remain active.

### Token Storage and Session Restoration

The current Okta architecture stores the access (and additional tokens) in `localStorage`:

```text
Current Okta Architecture

React / Next.js Application
       |
       +--> localStorage
              +-- access token
              +-- refresh token
              +-- ID token
```

The Keycloak architecture stores token only in ephemeral browser memory:

```text
Target Keycloak Architecture

Next.js browser context
       |
       +--> keycloak-js memory
       |      +-- access token
       |      +-- refresh token
       |      +-- ID token
       |
       +--> Keycloak SSO session
              +-- maintained by Keycloak browser cookies
```

Session restoration behavior:

| Scenario                      | Target behavior                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page reload                   | A new `keycloak-js` instance performs protected-app startup authentication and obtains a fresh token set when a usable Keycloak SSO session exists.                                                       |
| New browser tab/window        | The new browser context performs its own protected-app startup authentication and obtains its own token set when the Keycloak SSO cookie is still valid.                                                  |
| Closed app tab/window         | Reopening the application behaves like a new browser context. SSO works only if the browser retained and sends the Keycloak SSO cookie.                                                                   |
| Full browser restart          | SSO is restored only if the Keycloak browser session cookie is still present and valid. If Keycloak uses a browser-session cookie and the browser clears it on restart, the user must authenticate again. |
| No Keycloak SSO session       | Protected applications use `login-required` startup behavior or explicitly initiate interactive login when authentication is required.                                                                    |
| Keycloak SSO session expired  | Token refresh or SSO restoration fails and the application transitions to re-authentication.                                                                                                              |
| Explicit or inactivity logout | Keycloak logout terminates the shared SSO session; other tabs/applications detect this through the available Keycloak session mechanisms or on subsequent token refresh.                                  |

### Runtime Configuration

Keycloak and authentication configuration shall be externalized. In the Next.js App Router reference implementation, public browser configuration shall be read from environment variables on the server side and passed into the browser-only authentication boundary as a serializable configuration object. Only non-secret public settings shall be exposed to the browser; frontend OIDC clients remain public clients and shall not receive client secrets.

Reference implementation:

```ts
export function getPublicAuthConfig() {
  return {
    keycloakUrl: process.env.EXT_JNJ_IAM_URL ?? 'https://accounts.polyphonic.jnjmedtech.com',
    realm: process.env.EXT_JNJ_IAM_REALM_NAME ?? 'dev-euw1',
    clientId: process.env.EXT_JNJ_IAM_CLIENT_ID ?? 'phnc-surgery-app'
  };
}
```

The following values should be configurable:

| Environment Variable                        | Definition                                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXT_JNJ_IAM_URL`                           | Base URL of the Keycloak IAM service used by the application for OIDC authentication.                                                                |
| `EXT_JNJ_IAM_REALM_NAME`                    | Name of the Keycloak realm containing the application client and users. Base URL and realm construct the complete issuer URL.                        |
| `EXT_JNJ_IAM_CLIENT_ID`                     | OIDC client identifier of the frontend application registered in Keycloak.                                                                           |
| `EXT_JNJ_IAM_REDIRECT_URI`                  | Application URI to which Keycloak redirects the browser after authentication. Pattern: `${root-url}/signin`.                                         |
| `EXT_JNJ_IAM_POST_LOGOUT_REDIRECT_URI`      | Application URI to which Keycloak redirects the browser after logout. Pattern: `${root-url}/`.                                                       |
| `EXT_JNJ_IAM_SILENT_CHECK_SSO_REDIRECT_URI` | URI used by `keycloak-js` for silent SSO checks without an interactive login prompt. Pattern: `${root-url}/sso-signin`.                              |
| `EXT_JNJ_IAM_SILENT_CHECK_SSO_ENABLED`      | Enables iframe-based silent SSO checks. Defaults to `false` in the reference implementation for local/test reliability.                              |
| `EXT_JNJ_IAM_USER_INACTIVITY_TIMEOUT`       | Configurable period of user inactivity after which the application initiates logout and terminates the Keycloak SSO session, defaults to 15 minutes. |
| `EXT_JNJ_TMS_V2_ROOT_URL`                   | Base URL of the TMSv2 backend service used to request the Polyphonic authorization token.                                                            |
| `EXT_JNJ_TENANT_ID`                         | Optional tenant identifier appended to the TMSv2 authorization-token request as `tenantId`.                                                          |
| `EXT_JNJ_MOCK_AUTHORIZATION_TOKEN`          | Enables mock authorization-token mode for local/test environments where TMSv2 is unavailable. Defaults to `true` in the reference implementation.    |
| `EXT_JNJ_MOCK_AUTHORIZATION_APP`            | Mock authorization-token `app` claim.                                                                                                                |
| `EXT_JNJ_MOCK_AUTHORIZATION_TENANT`         | Mock authorization-token `tnt` claim.                                                                                                                |
| `EXT_JNJ_MOCK_AUTHORIZATION_ROLES`          | Comma-separated mock authorization-token `roles` claim.                                                                                              |
| `EXT_JNJ_IAM_INACTIVITY_WARNING_TIMEOUT`    | Time before the inactivity timeout at which the frontend displays the session-expiration warning dialog, defaults to 60 seconds.                     |

### Reference Implementation Packaging

This project provides app-local source as a copyable/reference example. The authentication implementation is not initially packaged as an npm dependency. A package can be introduced later if multiple applications need versioned dependency management for the shared authentication layer.

## Okta-to-Keycloak Refactoring Mapping

| EXISTING OKTA INTEGRATION     | TARGET KEYCLOAK INTEGRATION                |
| ----------------------------- | ------------------------------------------ |
| Okta Sign-In Widget           | Keycloak-hosted login                      |
| Okta JavaScript SDK           | `keycloak-js` JavaScript client            |
| Interaction Code Grant        | Authorization Code Flow + PKCE             |
| Embedded authentication UX    | Redirect-based OIDC authentication         |
| Okta AuthState                | Polyphonic `AuthProvider`                  |
| Okta tokens in `localStorage` | `keycloak-js` memory-only token storage    |
| Okta Token Manager            | `keycloak-js` token lifecycle              |
| Okta token renewal            | `keycloak.updateToken()`                   |
| Okta SSO                      | Keycloak realm SSO session                 |
| Silent Okta authentication    | Keycloak `check-sso` / `prompt=none`       |
| Okta logout                   | Keycloak OIDC logout                       |
| Okta-specific claims          | Polyphonic customized token claims         |
| Frontend idle handling        | Polyphonic configurable inactivity manager |
| Browser-only Okta integration | Next.js client authentication boundary     |

## Security Considerations

- Frontend: Authorization Code Flow shall always use PKCE `S256`.

- Frontend: `keycloak-js` JavaScript client shall execute only in the browser.

- Frontend: Access, refresh, and ID tokens shall not be persisted by the application in browser storage.

- Frontend: Authentication state and token lifecycle handling shall be centralized.

- Frontend: Protected content shall not be rendered before authentication initialization completes.

- Frontend: Frontend authorization controls shall not replace backend authorization.

- Frontend: Cross-application SSO shall reuse the Keycloak SSO session, not transfer tokens between applications.

- Frontend: Inactivity logout shall terminate the Keycloak SSO session, not merely delete local tokens.

- Frontend: Technical background activity shall not count as user activity.

- Frontend: Browser restrictions affecting silent `check-sso` shall be covered by the implementation and test strategy.

- Polyphonic IAM Service: Redirect URIs and Web Origins shall be restricted as tightly as possible.

- Polyphonic IAM Service: Dedicated application access shall be validated before tokens for the target client are issued.

## Migration Considerations

The refactoring shall identify all existing Okta dependencies, including:

- Okta Sign-In Widget integration;
- Okta SDK imports;
- authentication context/provider;
- authentication callback routes;
- route guards;
- token manager usage;
- token refresh behavior;
- API interceptors;
- logout handling;
- inactivity handling;
- claim parsing;
- role/access checks;
- issuer and endpoint configuration;
- authentication error handling;
- SSO navigation between Polyphonic applications;
- Next.js components currently depending on authentication during SSR or server execution.

Each dependency shall either be replaced by the centralized Keycloak integration layer or removed where responsibility is moved to Keycloak.

## Reference

Keycloak JavaScript Adapter documentation:
[https://www.keycloak.org/securing-apps/javascript-adapter](https://www.keycloak.org/securing-apps/javascript-adapter)

The Keycloak JavaScript adapter uses Authorization Code Flow by default, supports PKCE, `login-required`, `check-sso`, silent `check-sso`, logout, and token renewal through `updateToken()`. Keycloak documents access and refresh tokens as memory-only and recommends that applications do not persist them. Silent SSO and the session-status iframe are subject to modern browser third-party-cookie restrictions.
