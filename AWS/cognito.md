# Amazon Cognito

Cognito is actually two distinct services that are frequently used together and just as frequently confused in interviews: **User Pools** handle *authentication* (proving who a user is), and **Identity Pools** (also called Federated Identities) handle *authorization* (exchanging a proven identity for temporary AWS credentials). Understanding that split is the single most important thing to get right about Cognito.

A **User Pool** is a fully managed user directory — it stores usernames, hashed passwords, and custom attributes, and handles sign-up, sign-in, forgotten-password flows, account confirmation via email/SMS, and configurable password policies. It supports MFA (SMS or TOTP), and it supports federation from external identity providers — social logins (Google, Facebook, Apple, Amazon) and enterprise identity providers via SAML or OIDC — so a user pool can act as a single front door regardless of how the user actually authenticated upstream. On successful authentication, a user pool issues three JSON Web Tokens (JWTs): an **ID token** (contains the user's identity claims — sub, email, custom attributes — used by your application to know who's logged in), an **access token** (used to authorize calls to your own backend APIs, scoped by OAuth scopes/groups, not for direct AWS API calls), and a **refresh token** (long-lived, used to silently obtain new ID/access tokens without forcing the user to log in again).

An **Identity Pool**, by contrast, doesn't authenticate anyone itself — it takes an identity that's already been authenticated elsewhere (a Cognito User Pool token, a social login token, a SAML assertion, or even no identity at all for "unauthenticated guest" access) and exchanges it, via AWS STS, for temporary AWS credentials scoped by an IAM role. This is what lets a mobile or browser client upload directly to an S3 bucket, write directly to a DynamoDB table, or call other AWS services without routing every single request through a backend server that holds its own static AWS credentials — the client gets its own short-lived, appropriately scoped credentials instead. Identity Pools support role mapping based on user attributes or groups, so different authenticated users can receive different IAM roles (and thus different AWS permissions).

The two services compose naturally at the API layer too: API Gateway can be configured with a **Cognito User Pool authorizer**, which automatically validates the JWT (signature, expiry, issuer, audience) on every incoming request against the specified user pool — rejecting invalid or expired tokens before the request ever reaches your Lambda or backend integration, with zero custom authorizer code required. This is distinct from a Lambda authorizer, which you'd still reach for if you needed custom authorization logic beyond simple JWT validation (e.g., checking a claim against a database).

## Examples

```bash
# Create a User Pool with a password policy and self-service sign-up.
aws cognito-idp create-user-pool \
  --pool-name app-users \
  --policies '{"PasswordPolicy":{"MinimumLength":12,"RequireUppercase":true,"RequireNumbers":true,"RequireSymbols":true}}' \
  --auto-verified-attributes email \
  --mfa-configuration OPTIONAL
```
This provisions the managed user directory with a strong password policy and email verification — the foundation for authentication before any client-side sign-up flow can be built against it.

```yaml
# CloudFormation snippet: an Identity Pool that maps authenticated User Pool users
# to an IAM role scoped to only their own S3 prefix.
AppIdentityPool:
  Type: AWS::Cognito::IdentityPool
  Properties:
    IdentityPoolName: AppIdentityPool
    AllowUnauthenticatedIdentities: false
    CognitoIdentityProviders:
      - ClientId: !Ref AppUserPoolClient
        ProviderName: !GetAtt AppUserPool.ProviderName

AuthenticatedRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Statement:
        - Effect: Allow
          Principal: { Federated: cognito-identity.amazonaws.com }
          Action: sts:AssumeRoleWithWebIdentity
          Condition:
            StringEquals: { cognito-identity.amazonaws.com:aud: !Ref AppIdentityPool }
            ForAnyValue:StringLike: { cognito-identity.amazonaws.com:amr: authenticated }
    Policies:
      - PolicyName: UserOwnPrefixOnly
        PolicyDocument:
          Statement:
            - Effect: Allow
              Action: [s3:GetObject, s3:PutObject]
              Resource: "arn:aws:s3:::app-uploads/${cognito-identity.amazonaws.com:sub}/*"
```
This wires a User Pool to an Identity Pool and shows the policy variable pattern (`${cognito-identity.amazonaws.com:sub}`) that scopes each authenticated user's temporary AWS credentials to only their own S3 prefix — the client can upload directly to S3 without a backend proxy, and without ever being able to touch another user's files.

```javascript
// Client-side: authenticate against a User Pool, then get AWS credentials via an Identity Pool.
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity";

const idp = new CognitoIdentityProviderClient({ region: "us-east-1" });
const auth = await idp.send(new InitiateAuthCommand({
  AuthFlow: "USER_PASSWORD_AUTH",
  ClientId: "abc123appclientid",
  AuthParameters: { USERNAME: "user@example.com", PASSWORD: "********" },
}));
const idToken = auth.AuthenticationResult.IdToken;

const identity = new CognitoIdentityClient({ region: "us-east-1" });
const { IdentityId } = await identity.send(new GetIdCommand({
  IdentityPoolId: "us-east-1:xxxx-xxxx",
  Logins: { [`cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123`]: idToken },
}));
const { Credentials } = await identity.send(new GetCredentialsForIdentityCommand({
  IdentityId, Logins: { [`cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123`]: idToken },
}));
// Credentials.AccessKeyId / SecretKey / SessionToken can now sign direct AWS SDK calls.
```
This is the full two-step flow end to end: authenticate against the User Pool to get an ID token, then exchange that token via the Identity Pool for temporary STS-issued AWS credentials the client can use to call AWS services directly.

## Common Pitfalls / Gotchas

- Confusing User Pools and Identity Pools as interchangeable or redundant — they solve different problems (authentication vs. AWS authorization) and most production apps that call AWS services directly from a client need both, wired together.
- Using the access token where the ID token was needed, or vice versa — the ID token carries identity claims for your app to consume, while the access token is meant for authorizing calls to your own resource servers/APIs; neither is meant to be sent directly to AWS APIs (that's what Identity Pool credential exchange is for).
- Forgetting to set `AllowUnauthenticatedIdentities` deliberately — leaving guest/unauthenticated access enabled on an Identity Pool when it isn't needed silently allows anonymous callers to obtain scoped AWS credentials, which is often an unintended security gap.
- Not scoping the IAM role attached to authenticated Identity Pool users with per-user policy variables (like `cognito-identity.amazonaws.com:sub`) — without that, every authenticated user shares one broad role and can access other users' data.
- Assuming Cognito User Pool JWTs never need server-side validation just because API Gateway's Cognito authorizer checked them — if a Lambda or backend also receives the token directly (bypassing the authorizer), it must still validate the signature against the pool's JWKS endpoint, issuer, audience, and expiry itself.
- Underestimating token expiry handling — ID and access tokens are short-lived (default 1 hour); apps that don't correctly use the refresh token to silently renew them will see users abruptly logged out mid-session.

## Interview Questions & Answers

**Q: What's the difference between a Cognito User Pool and an Identity Pool?**
A: A User Pool is an authentication service — a managed user directory handling sign-up, sign-in, password policies, MFA, and federation from social/SAML/OIDC providers, issuing JWTs on success. An Identity Pool is an authorization service — it takes an already-authenticated identity (from a User Pool, a social provider, or even unauthenticated guest access) and exchanges it via STS for temporary, IAM-role-scoped AWS credentials. In short: User Pools answer "who is this user," Identity Pools answer "what can this user do in AWS."

**Q: Why would a mobile app use an Identity Pool instead of just calling your backend for everything?**
A: An Identity Pool lets the client obtain temporary AWS credentials directly, scoped by an IAM role, so it can call AWS services (like uploading a photo straight to S3, or reading from DynamoDB) without every single request having to be proxied through a backend server holding its own broad AWS credentials. This reduces backend load and latency for such operations and avoids a single set of powerful static credentials living in your backend for actions that could instead be safely delegated per-user with narrow, expiring permissions.

**Q: What are the three tokens a User Pool issues after login, and what's each one for?**
A: The ID token carries identity claims (user attributes like sub, email) for your application to know who's logged in and display/use their profile data. The access token is used to authorize calls to your own protected backend resources/APIs, scoped by OAuth scopes or group membership — it is not meant for direct AWS API calls. The refresh token is long-lived and used to silently obtain fresh ID and access tokens once the short-lived ones expire, without forcing the user to log in again.

**Q: How does API Gateway integrate with Cognito for securing an API?**
A: You attach a Cognito User Pool authorizer to a REST or HTTP API route in API Gateway; API Gateway then automatically validates the JWT's signature, expiry, issuer, and audience against the specified user pool on every incoming request, rejecting invalid tokens before they ever reach your Lambda or backend integration. This replaces writing custom Lambda authorizer code for the common case of "just verify this is a valid, non-expired token issued by our user pool" — you'd still write a Lambda authorizer for anything requiring custom logic beyond token validation.

**Q: A client obtains valid AWS credentials from an Identity Pool but still gets AccessDenied calling S3. What should you check?**
A: Check the IAM role mapped to the Identity Pool for that user's authentication state (authenticated vs. unauthenticated role) — its attached policy determines what the temporary credentials can actually do, independent of whether the identity itself was validated successfully. A common cause is the role's policy being scoped too narrowly (e.g., to a specific S3 prefix via a policy variable like `cognito-identity.amazonaws.com:sub`) and the request targeting a resource outside that scope, or the identity pool's role mapping rules routing the user to the wrong role entirely.

## Related Topics
- [iam.md](./iam.md)
- [api-gateway.md](./api-gateway.md)
- [data-encryption.md](./data-encryption.md)
- [network-security.md](./network-security.md)
- [s3.md](./s3.md)
