# Amazon API Gateway

API Gateway is a managed front door for backend services — it terminates HTTP(S)/WebSocket connections from clients, applies authentication/authorization, throttling, request/response transformation, and routing, then forwards to a backend integration (Lambda, HTTP endpoint, another AWS service, or a VPC-internal resource via a VPC Link). It exists so that the backend doesn't have to implement cross-cutting concerns like API-key management, rate limiting, request validation, and CORS itself — those live in the gateway layer instead.

There are three API types, each with materially different capabilities. REST APIs are the original, full-feature offering: request/response transformation via Velocity Template Language (VTL) mapping templates, usage plans paired with API keys for metering/throttling per customer, response caching, AWS WAF integration for request-level filtering, and private APIs reachable only from within a VPC. HTTP APIs are a newer, cheaper, lower-latency alternative (up to ~70% lower cost, roughly half the latency overhead) but with a deliberately smaller feature set — no VTL mapping templates or usage-plan API keys, but native, first-class OIDC/OAuth2 JWT authorizers that REST APIs lack. WebSocket APIs maintain persistent, bidirectional connections for use cases like chat applications, live dashboards, or multiplayer features, routing each inbound message to a different backend integration based on a route key you define (e.g., a `$connect`, `$disconnect`, and custom action routes), with connection state tracked via a connection ID you manage yourself (typically stored in DynamoDB).

Lambda integration comes in two forms. Lambda proxy integration passes the entire raw request (headers, query params, body, path params) through to the function as a single event object and expects the function to return a specific response shape (`statusCode`, `headers`, `body`) — all request/response handling logic lives in your code, which is simpler to reason about and is the default choice for most new APIs. Lambda custom integration instead uses API Gateway's VTL mapping templates to transform the incoming request into a custom shape before it reaches Lambda, and transforms the Lambda response again before returning it to the client — more setup and VTL complexity, but useful when you want the gateway itself to enforce a strict contract independent of what the backend returns, or when integrating with a non-Lambda-aware legacy backend.

Authorization can be layered three ways: IAM authorizers use SigV4-signed requests and IAM policies, appropriate for internal service-to-service calls already living inside AWS's IAM trust boundary. Lambda authorizers (custom or token-based) run your own authorization logic — validate a custom token format, check a database, call a third-party auth service — and return an IAM policy document plus optional context that gets passed to the backend integration; results can be cached by the incoming token to avoid running the authorizer on every request. Cognito User Pool authorizers validate a JWT issued by Cognito directly at the gateway layer with no custom code required, the simplest option when Cognito is already your identity provider.

Throttling is enforced with a token-bucket algorithm at account, stage, and method/route level, each with a steady-state rate (tokens replenished per second) and a burst capacity (bucket size, absorbing short spikes above the steady rate) — a request that exceeds the applicable bucket is rejected with a 429 before it ever reaches your backend, which is a deliberate design point: the gateway protects downstream systems (and your Lambda concurrency budget) from being overwhelmed, rather than relying on the backend to self-throttle.

## Examples

```yaml
# CloudFormation: an HTTP API with a JWT authorizer backed by Cognito, routed to a
# Lambda proxy integration — the modern, lower-cost default for a new authenticated API
Resources:
  HttpApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: orders-api
      ProtocolType: HTTP

  JwtAuthorizer:
    Type: AWS::ApiGatewayV2::Authorizer
    Properties:
      ApiId: !Ref HttpApi
      AuthorizerType: JWT
      IdentitySource: ["$request.header.Authorization"]
      JwtConfiguration:
        Audience: [!Ref CognitoAppClientId]
        Issuer: !Sub "https://cognito-idp.${AWS::Region}.amazonaws.com/${CognitoUserPoolId}"

  OrdersRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref HttpApi
      RouteKey: "GET /orders"
      AuthorizationType: JWT
      AuthorizerId: !Ref JwtAuthorizer
      Target: !Sub "integrations/${OrdersIntegration}"
```

```bash
# Create a usage plan with API keys and per-key throttling on a REST API — the
# per-customer metering/rate-limiting pattern that HTTP APIs deliberately omit
aws apigateway create-usage-plan \
  --name gold-tier \
  --throttle burstLimit=200,rateLimit=100 \
  --quota limit=1000000,period=MONTH \
  --api-stages apiId=abc123def4,stage=prod

aws apigateway create-api-key --name customer-acme --enabled
aws apigateway create-usage-plan-key --usage-plan-id up-xyz --key-id key-abc --key-type API_KEY
```

```javascript
// Lambda proxy integration handler (Node.js) — the whole raw request arrives as
// `event`, and the function is responsible for returning the exact response shape
// API Gateway expects, including statusCode and headers.
export const handler = async (event) => {
  const orderId = event.pathParameters.id;
  const body = JSON.parse(event.body ?? "{}");

  if (!orderId) {
    return { statusCode: 400, body: JSON.stringify({ error: "missing order id" }) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, status: "confirmed", ...body }),
  };
};
```

## Common Pitfalls / Gotchas

- Choosing REST APIs by default out of habit — for most new Lambda-backed APIs, HTTP APIs are cheaper, faster, and support native JWT authorizers; REST APIs are only the right pick when you specifically need VTL mapping templates, usage-plan API keys, response caching, or WAF integration.
- Forgetting that a Lambda authorizer's IAM policy response can be cached (by the raw token value) for a configurable TTL — a stale cached "allow" decision can grant access after a token should have been revoked, and a stale "deny" can block a legitimately re-authorized user until the cache expires.
- Not configuring CORS at the gateway (`OPTIONS` preflight responses, `Access-Control-Allow-Origin` headers) and instead trying to handle it purely inside a Lambda — preflight `OPTIONS` requests often need a mock/gateway-level response since browsers send them without any auth headers your Lambda authorizer might require.
- Hitting default account/stage throttle limits during a legitimate traffic spike because nobody explicitly raised or configured them — the default steady-state/burst limits are conservative and silently return 429s once exceeded.
- Using Lambda custom integration with hand-written VTL mapping templates for complex payloads — VTL is difficult to debug and test locally, and most teams underestimate how much time gets spent troubleshooting a broken template versus just using proxy integration and handling transformation in code.
- Assuming a private REST API (VPC-only, via an interface VPC endpoint) is reachable the same way as a public one — private APIs require the resource policy and VPC endpoint to be configured correctly together, and a misconfigured resource policy silently blocks all traffic with no obvious error on the client side.

## Interview Questions & Answers

**Q: When would you choose HTTP APIs over REST APIs?**
A: HTTP APIs for most new Lambda-backed or HTTP-backed APIs — they're cheaper (up to ~70% lower cost), have lower latency overhead, and have native OIDC/OAuth2 JWT authorizer support built in. REST APIs when you specifically need features HTTP APIs don't have: VTL request/response mapping templates, usage plans with API keys for per-customer metering, built-in response caching, direct AWS WAF integration, or private (VPC-only) API endpoints.

**Q: Explain the difference between Lambda proxy integration and Lambda custom integration.**
A: Proxy integration passes the entire raw HTTP request through to Lambda as a single event object untouched, and expects the function to return a specific response shape (statusCode, headers, body) — all transformation logic lives in application code, which is simpler and is the default for most new APIs. Custom integration uses API Gateway's VTL mapping templates to transform the request before it reaches Lambda and transform the response again before it reaches the client, letting the gateway enforce a contract independent of the backend's native input/output shape — more setup complexity, typically reserved for integrating a legacy or non-Lambda-aware backend.

**Q: What are the three authorizer types API Gateway supports, and when would you use each?**
A: IAM authorizers use SigV4-signed requests validated against IAM policies, appropriate for trusted internal service-to-service calls already inside AWS's IAM boundary. Lambda authorizers run custom authorization code you write — validating a proprietary token format, checking a database, or calling an external auth provider — and return an IAM policy plus optional context, with results cacheable by token to reduce latency/cost on repeated calls. Cognito User Pool authorizers validate a Cognito-issued JWT directly at the gateway with zero custom code, the simplest option when Cognito is already the identity provider.

**Q: How does API Gateway throttling work, and why put it at the gateway instead of relying on the backend?**
A: Throttling uses a token-bucket algorithm applied at account, stage, and method/route level — each bucket has a steady-state refill rate and a burst capacity for absorbing short spikes; requests beyond the applicable bucket's capacity are rejected with a 429 before ever reaching the backend integration. Enforcing this at the gateway protects downstream systems — a Lambda function's account-level concurrency limit, or a database behind it — from being overwhelmed, and does so without spending any backend compute on requests that are going to be rejected anyway.

**Q: What's the purpose of a usage plan and API key, and how is that different from an authorizer?**
A: An authorizer answers "is this caller allowed to access this API at all" — authentication/authorization. A usage plan paired with an API key answers a different question: "how much is this specific, already-authorized customer/partner allowed to call this API" — it's a metering and per-customer throttling/quota mechanism, commonly used to implement tiered API products (e.g., a "gold" plan with a higher rate limit and monthly quota than a "free" plan). The two are complementary and often layered together: an authorizer to gate access, a usage plan to meter and rate-limit it per customer.

## Related Topics
- [lambda.md](./lambda.md)
- [cognito.md](./cognito.md)
- [iam.md](./iam.md)
- [cloudfront.md](./cloudfront.md)
- [vpc.md](./vpc.md)
- [cloudwatch.md](./cloudwatch.md)
