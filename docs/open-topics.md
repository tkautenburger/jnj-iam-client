# Open Topics

- Are target frontend apps Next.js App Router, Pages Router, or mixed?
target frontend applications are Next.js App Router applications

- Should this repo stay a Vite playground, or become the reusable reference implementation/package?
it should become a re-usable reference implementation

- What is the exact Polyphonic authorization-token API contract?
The authorization token must be requested from a polyphonic backend service via a POST call to 
${tms-v2-root-url}/api/v2/token. The valid access token must be presented in the Authorization HTTP
header. The response provides the Base64 encoded authorization JWT token in the X-Authorization
HTTP header of the response and must be extracted from the client application to have access to the 
claims listed in the next answer. 

- What claims replace resource_access for frontend/backend authorization?
frontend/backend services use the authorization token for permission enforcement. The authorization 
token has claims identifying the authorized application (app), the tenant for the user (tnt) and the
list of application roles (roles) assigned to the user. Role assignment is separated from the 
keycloak iam service and done by the Polyphonic TMSv2 backend application. 

- What is the application-access role naming convention per Keycloak client?
The name is "access" and the role is only internally used in keycloak and not minted in the
access token. So no reason, a frontend needs to care about application access roles. 

- What should happen on no SSO session: stay anonymous, auto-login, or protect all routes?
If no SSO session cookie is present, the user should be directed to auto-login.

- What is the required inactivity timeout per environment?
We can start here with 20 minutes as an example. the value shall be configurable by environment.

- What exact user events count as activity?
That is described in the architecture concept. We will take this as a reference list for user events
that restart the inactivity timer. 

- Should inactivity logout warn the user before ending the SSO session?
Yes, in todays applications the user is warned shortly before the timeout and can press a button
in a dialog that restarts the inactivity timer. 

- What are the production redirect URI, logout URI, web origin, and silent SSO URI patterns?
  login-redirect uri is ${root-url}/signin
  logout-redirect uri is $(root-url)/
  silent-sso-uri pattern is new concept, lets take ${root-url}/sso-signin

- Which browsers must be supported, especially for silent check-sso behavior?
  It should support current Chrome, Safari, and MS Edge browsers.

- How should SSR/server-side authenticated API calls be handled, or are they explicitly out of scope?
 SSR authenticated API calls are out of scope.
