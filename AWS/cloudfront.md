# CloudFront

CloudFront is AWS's content delivery network (CDN): a global fleet of edge locations that caches content physically close to end users, so repeat requests are served from a nearby edge cache instead of traveling all the way back to your origin server. This cuts latency for end users and cuts load/cost on the origin, since only cache misses (and content marked non-cacheable) actually reach it. A CloudFront distribution sits in front of one or more origins and is configured with cache behaviors that decide, per path pattern, how requests should be cached, forwarded, and transformed.

Origins can be S3 buckets (the classic static-assets/SPA pattern), an ALB, EC2, or any custom HTTP(S) origin, or specialized origins like MediaStore/MediaPackage for video streaming workloads. When the origin is S3, the modern best practice is Origin Access Control (OAC), which lets CloudFront sign its requests to S3 so you can lock the bucket down to deny all public access and only allow requests that came through your specific distribution — this prevents someone from bypassing your CDN, cache rules, and any access restrictions by hitting the S3 URL directly. OAC replaced the older Origin Access Identity (OAI) mechanism, which is deprecated for new distributions in favor of OAC's broader support (including SSE-KMS-encrypted objects and all S3 regions).

Cache behaviors are path-pattern-based rules (e.g. `/images/*`, `/api/*`, default `*`) that each control TTLs, which HTTP methods are allowed (GET/HEAD-only for pure static content vs allowing POST/PUT for API paths that should pass through), and critically, the cache key — which query string parameters, headers, and cookies get included when CloudFront decides whether two requests are "the same" for caching purposes. Getting the cache key wrong is one of the most common CloudFront bugs: including too many headers/cookies in the key destroys your cache hit rate (nearly every request looks unique), while excluding something that actually varies the response (like an `Accept-Language` header for localized content) causes CloudFront to serve the wrong cached response to different users.

For restricting access to private content, CloudFront supports signed URLs (a single URL with an attached signature and expiration, good for giving one user access to one specific file) and signed cookies (a set of cookies that authorize access to multiple resources matching a path pattern, better for something like a video-streaming session where many segment requests need authorization without individually signing each URL). Both rely on a CloudFront key pair / trusted key group and a policy defining what's allowed and until when.

For running code at the edge, CloudFront offers two different tools depending on how much you need to do. Lambda@Edge runs full Lambda functions (Node.js or Python) at edge locations, has the full Lambda feature set and longer execution time budgets, and can run at four points in the request/response cycle (viewer request, origin request, origin response, viewer response) — appropriate for things like A/B testing logic, authentication/authorization, or response body rewriting. CloudFront Functions are JavaScript-only, execute in sub-millisecond time with a much lighter runtime and stricter feature limits, and are meant for lightweight, high-volume tasks like header manipulation, redirects, or simple request/response rewrites — they're cheaper and faster for use cases that don't need Lambda@Edge's full capability.

## Examples

```bash
# Create a CloudFront Origin Access Control for a private S3 origin
aws cloudfront create-origin-access-control --origin-access-control-config '{
  "Name": "app-oac",
  "OriginAccessControlOriginType": "s3",
  "SigningBehavior": "always",
  "SigningProtocol": "sigv4"
}'
```
This is the modern way to let CloudFront authenticate to S3; pairing it with a bucket policy that only allows `cloudfront.amazonaws.com` with a matching distribution ARN condition keeps the bucket fully private otherwise.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipalReadOnly",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::app-static-assets/*",
    "Condition": {
      "StringEquals": {"AWS:SourceArn": "arn:aws:cloudfront::123456789012:distribution/E1A2B3C4D5E6F7"}
    }
  }]
}
```
The bucket policy half of the OAC setup: it scopes access to exactly one distribution's requests, so even if someone finds the bucket's S3 URL, direct requests are denied and only traffic that has come through CloudFront (and thus through your cache rules, WAF, etc.) succeeds.

```javascript
// CloudFront Function (viewer request) to redirect bare domain to canonical host
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;
  if (host === 'example.com') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://www.example.com' + request.uri } }
    };
  }
  return request;
}
```
A lightweight, sub-millisecond redirect rule running at every edge location — cheaper and lower-latency than routing this logic back to an origin server or using the heavier Lambda@Edge for something this simple.

## Common Pitfalls / Gotchas

- Leaving an S3 origin bucket publicly readable "just in case" after setting up CloudFront — this defeats the entire purpose of OAC/OAI, since anyone can bypass your CDN, cache behaviors, and signed URL restrictions by hitting the S3 URL directly.
- Including unnecessary headers, cookies, or query strings in the cache key — this fragments the cache (near-zero hit rate) because CloudFront treats requests that differ only in an irrelevant header/cookie as entirely different cache entries.
- Excluding a header/query string from the cache key that actually changes the response (e.g. `Accept-Language`, an `A/B-test` cookie, or an `?format=` query param) — CloudFront serves the wrong cached variant to users who should have gotten a different response.
- Forgetting that invalidations are not instant or free beyond a monthly free tier — pushing frequent invalidations for content that changes often is expensive and slow; better to use versioned/hashed file names (cache-busting via the URL itself) for frequently updated assets.
- Confusing Lambda@Edge and CloudFront Functions capability — trying to do something that needs network calls, larger memory, or longer execution time in a CloudFront Function will fail; that workload belongs in Lambda@Edge, at the cost of higher latency and price per invocation.
- Not setting a sensible default TTL/behavior for error responses — without custom error caching configured, a transient 5xx from the origin can get cached and served to many users for longer than intended, or conversely never cached at all, hammering a struggling origin with retries.

## Interview Questions & Answers

**Q: What's the difference between Origin Access Control (OAC) and the older Origin Access Identity (OAI), and why does AWS recommend OAC now?**
A: Both let CloudFront authenticate to a private S3 origin bucket so it can be locked down from public/direct access, but OAI predates SigV4-based signing and has gaps — notably it doesn't support SSE-KMS-encrypted S3 objects well and isn't available in every region/config combination. OAC uses SigV4 signing for every request CloudFront makes to S3, supports SSE-KMS, and is the currently recommended mechanism; OAI is considered legacy and AWS steers new distributions toward OAC.

**Q: How does the cache key affect CloudFront's hit rate, and what's a mistake you'd want to avoid?**
A: The cache key is the set of request attributes (default: full URL path plus, optionally, whichever headers/cookies/query strings you explicitly include) CloudFront uses to decide whether two requests can share a cached response. Including too much (e.g. forwarding all headers/cookies) means nearly every request is treated as unique, tanking your hit rate and pushing most traffic back to the origin. Including too little means CloudFront might serve a cached response that's actually wrong for a given user/locale/variant — e.g. omitting `Accept-Language` when your origin returns localized content. The fix is to include only the specific headers/cookies/query params that actually change the response, nothing more.

**Q: When would you use Lambda@Edge instead of CloudFront Functions?**
A: When you need something CloudFront Functions can't do at all — network/API calls, access to a larger set of Lambda features, longer execution time, or Node/Python-specific logic (e.g. complex auth token validation against an external service, body rewriting requiring heavier processing). CloudFront Functions are for lightweight, extremely high-volume tasks (header manipulation, simple redirects, basic auth checks) where sub-millisecond execution and lower cost matter more than feature richness.

**Q: How would you serve private video content to only authenticated users through CloudFront?**
A: Use signed URLs or signed cookies generated by your backend after verifying the user's session/entitlement, using a CloudFront key pair (or trusted key group) and a policy that defines the allowed resource path pattern and an expiration. Signed cookies are usually the better fit for something like video streaming, since a single set of cookies can authorize many segment/manifest requests under a path pattern, whereas a signed URL would need to be individually generated (and re-signed on expiry) for every single request.

**Q: A user says they're seeing stale content on your site even after you deployed a fix. What are your options, and what's the tradeoff?**
A: You can create a CloudFront invalidation for the affected paths, which forces CloudFront to re-fetch from the origin on the next request — but invalidations aren't instant, have a modest free-tier quota, and cost money beyond it, and creating them frequently as your standard deploy process doesn't scale well. The better long-term fix is cache-busting via versioned/hashed filenames (e.g. `app.a1b2c3.js`) referenced by a non-cached HTML entry point, so "new content" is just a new URL rather than requiring you to invalidate an old cached one.

## Related Topics
- [route-53.md](./route-53.md)
- [s3.md](./s3.md)
- [network-security.md](./network-security.md)
- [elastic-load-balancing.md](./elastic-load-balancing.md)
- [data-encryption.md](./data-encryption.md)
- [observability.md](./observability.md)
