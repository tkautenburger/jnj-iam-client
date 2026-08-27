# jnj-iam-client

Next.js App Router reference implementation for exercising the `keycloak-js` browser client against the local `jnj-iam` Keycloak realm and the Polyphonic TMSv2 authorization-token flow.

## Purpose

This project is the home for demo and playground applications that show how browser clients should authenticate with Polyphonic IAM.

The current reference app:

- reads public runtime configuration from server-side environment variables;
- initializes `keycloak-js` with authorization code flow, PKCE, and SSO discovery;
- redirects to hosted Keycloak login when no SSO session exists;
- requests the Polyphonic authorization token from TMSv2;
- can mock the Polyphonic authorization token when TMSv2 is unavailable;
- keeps Keycloak and Polyphonic authorization tokens in browser memory only;
- coordinates inactivity state between same-origin tabs without sharing tokens;
- displays basic profile, authorization, and session-policy state after authentication.

## Architecture Document

Find the architecture design document under `docs/architecture.md`. Use that document to drive the next implementation steps.

## Configure

Set environment variables if the local IAM realm, frontend client, or TMSv2 backend changes. The following settings are based on a local Keycloak installation without public DNS / hostname:

```bash
EXT_JNJ_ROOT_URL=http://localhost:3000
EXT_JNJ_IAM_URL=https://localhost
EXT_JNJ_IAM_REALM_NAME=phnc-dev
EXT_JNJ_IAM_CLIENT_ID=phnc-test-app
EXT_JNJ_IAM_SCOPE="openid profile email nucleus"
EXT_JNJ_IAM_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
EXT_JNJ_TMS_V2_ROOT_URL=http://localhost:3000
EXT_JNJ_TENANT_ID=
EXT_JNJ_MOCK_AUTHORIZATION_TOKEN=true
EXT_JNJ_MOCK_AUTHORIZATION_APP=phnc-test-app
EXT_JNJ_MOCK_AUTHORIZATION_TENANT=local-test
EXT_JNJ_MOCK_AUTHORIZATION_ROLES=user
EXT_JNJ_IAM_USER_INACTIVITY_TIMEOUT=900000
EXT_JNJ_IAM_INACTIVITY_WARNING_TIMEOUT=60000
```

These defaults match the local `jnj-iam` realm import conventions. Browser app clients use `/signin` as the login redirect path, `/sso-signin` as the silent SSO redirect path, and the application root URL as the post-logout redirect URI.

`EXT_JNJ_MOCK_AUTHORIZATION_TOKEN=true` lets the reference app run without a TMSv2 backend. The generated token is an unsigned JWT-shaped test token and must not be used as a production authorization artifact.

## Run

If you are on a JnJ workstation behind Zscaler you need to have the JnJ Artifactory as node package proxy configured and authorized. In case you haven't setup the JnJ Artifactory as npm proxy go to the [JnJ Node repo](https://artifactrepo.jnj.com/ui/repos/tree/General/jnj-node) and generate a token using "Set Me Up" and follow the described configuration procedure. You need to specify the Artifactory repository during package installation.

```bash
npm install [--registry https://artifactrepo.jnj.com/artifactory/api/npm/jnj-node/]
npm run dev
```

Open:

```text
http://localhost:3000
```

For the default local realm, the matching Keycloak client should allow:

```text
Valid redirect login URIs: http://localhost:3000/signin, http://localhost:3000/sso-signin
Valid redirect logout URIs: http://localhost:3000/
Web origins: http://localhost:3000
Client authentication: Off
Standard flow: On
Proof Key for Code Exchange Code Challenge Method: S256
```
