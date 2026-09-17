# Amazon Chime / Chime SDK

Amazon Chime originally shipped as an end-user product — a Zoom/Teams-style application for video meetings, chat, and business calling that AWS sold as a standalone communications tool. AWS deprecated the standalone Chime application for new customers in 2021-2022 and shifted focus entirely to the Chime SDK, which is the part that actually shows up in interviews today: a set of APIs and client libraries that let you embed real-time audio, video, messaging, and PSTN (regular telephone network) calling directly into your own application, rather than asking users to go use a separate Chime app at all. Understanding this split — the app is largely legacy, the SDK is the current, actively developed AWS offering — is itself a common point of confusion worth clearing up in an interview answer.

The Chime SDK is organized into a few focused capabilities that are typically combined rather than used in isolation. The Meetings SDK provides the building blocks for real-time audio/video sessions — create a meeting, add attendees, and the SDK handles the WebRTC media session, echo cancellation, and adaptive bitrate under the hood, while your application supplies the UI. The Messaging SDK provides persistent chat (channels, messages, reactions) with its own delivery and moderation APIs, usable independently of any live audio/video session. The PSTN Audio (Voice SDK / Chime SDK for phone calling) piece specifically handles the bridge into and out of the traditional telephone network — dialing a real phone number from your app, or letting a real phone caller join a session your application manages — encoded as SIP media applications with rules that can trigger AWS Lambda functions to control call flow programmatically (answer, transfer, play audio, join a meeting).

The dominant real-world use case is embedding communications into an existing product rather than asking users to leave it — a telehealth app that needs in-app video visits, a marketplace app that needs an in-app voice call between buyer and seller without exposing either party's real phone number, or a SaaS support tool that needs live screen-share/video sessions between an agent and a customer. Contact center integration is the other major pattern: Chime SDK's PSTN capabilities pair with Amazon Connect (AWS's separate managed contact-center-as-a-service product) to give a contact center both the ability to receive/route real phone calls and to layer in programmatic call control, IVR logic via Lambda, and recording/analytics — Chime SDK supplies the telephony building blocks, Connect supplies the contact-center workflow and agent-desktop layer built on top of them.

It's worth being explicit in an interview about what Chime SDK is not: it isn't a drop-in meeting app you configure and point users at (that's what the now-legacy Chime app was) — it's infrastructure you build your own application experience on top of, closer in spirit to Twilio's programmable video/voice APIs than to Zoom. The tradeoff for that extra integration work is that the resulting experience is fully embedded in your product's UI and auth model, with no user ever needing a separate account or app, which is exactly the requirement that makes standalone meeting apps a poor fit for use cases like telehealth or in-app customer support calls.

## Examples

```bash
# Create a Chime SDK meeting and add an attendee — the SDK returns join
# tokens the client-side SDK (JS/iOS/Android) uses to join the WebRTC session
aws chime-sdk-meetings create-meeting \
  --client-request-token "$(uuidgen)" \
  --media-region us-east-1 \
  --external-meeting-id "support-session-8842"

aws chime-sdk-meetings create-attendee \
  --meeting-id abc123-meeting-id \
  --external-user-id "customer-5521"
```

```json
// IAM policy scoping an application backend to only what it needs to
// create meetings and attendees — not full chime-sdk-meetings:* access
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "chime-sdk-meetings:CreateMeeting",
      "chime-sdk-meetings:CreateAttendee",
      "chime-sdk-meetings:DeleteMeeting"
    ],
    "Resource": "*"
  }]
}
```

```python
# PSTN Audio: a Lambda function invoked by a SIP media application to
# programmatically answer an inbound call and join it to a live meeting
def handler(event, context):
    if event["InvocationEventType"] == "NEW_INBOUND_CALL":
        return {
            "SchemaVersion": "1.0",
            "Actions": [{
                "Type": "JoinChimeMeeting",
                "Parameters": {
                    "JoinToken": event["CallDetails"]["Participants"][0].get("JoinToken", ""),
                    "CallId": event["CallDetails"]["Participants"][0]["CallId"],
                }
            }]
        }
```

## Common Pitfalls / Gotchas

- Confusing the legacy Chime end-user app with the Chime SDK — the standalone app is deprecated for new customers, and interview/production relevance today is almost entirely about the SDK, which is embedded infrastructure, not a ready-made application.
- Assuming Chime SDK gives you a UI out of the box — it provides the media session, signaling, and control-plane APIs; you build the actual meeting/call UI yourself using the client SDKs (JavaScript, iOS, Android).
- Not scoping IAM permissions to specific `chime-sdk-meetings`/`chime-sdk-voice` actions — granting broad Chime access to an application backend is unnecessary and violates least privilege, the same as with any other AWS service.
- Overlooking media region selection — `CreateMeeting`'s media region affects latency for participants; picking a region far from your actual users adds avoidable latency to every call.
- Conflating Chime SDK with Amazon Connect — Chime SDK provides low-level communications building blocks (meetings, messaging, PSTN); Connect is the higher-level managed contact-center product that often sits on top of similar telephony capabilities but adds routing, IVR, queues, and agent-desktop tooling that Chime SDK alone doesn't provide.
- Forgetting to clean up meetings/attendees — meeting resources that aren't explicitly deleted after a session ends can leave stale state and complicate reasoning about active sessions, since the SDK doesn't automatically expire everything the instant participants disconnect.

## Interview Questions & Answers

**Q: What is the Chime SDK, and how is it different from the Chime application?**
A: The Chime application was AWS's standalone end-user meeting/chat app, now deprecated for new customers. The Chime SDK is a set of APIs and client libraries for embedding real-time audio, video, messaging, and phone (PSTN) calling directly into your own application — you build the UI and control the integration; AWS handles the underlying media session and signaling infrastructure.

**Q: When would you reach for the Chime SDK instead of just telling users to use Zoom or Teams?**
A: When the communication needs to be embedded inside your own product's experience and auth model rather than requiring users to leave it for a separate app — for example, an in-app video visit in a telehealth product, or an in-app voice call between a marketplace buyer and seller that doesn't expose either party's real phone number. The tradeoff is you own building the UI and integration work, in exchange for a fully embedded experience with no separate account required.

**Q: How does Chime SDK's PSTN Audio capability work at a mechanical level?**
A: It's built on SIP media applications with rules that route inbound/outbound calls to AWS Lambda functions, which receive call lifecycle events (like a new inbound call) and return programmatic actions — answer, play audio, transfer, or join the call to an active Chime SDK meeting. This is what lets a real phone call from the traditional telephone network be bridged into or out of an application-controlled session.

**Q: How does Chime SDK relate to Amazon Connect?**
A: They're complementary, not competing — Chime SDK provides the low-level communications building blocks (meetings, messaging, PSTN call control), while Amazon Connect is a higher-level, fully managed contact-center-as-a-service product that layers routing, IVR flows, queues, and an agent-desktop UI on top of similar telephony capabilities. A contact center use case often uses Connect for the overall workflow and may use Chime SDK primitives underneath for specific embedded communication needs.

**Q: What's a common design mistake when building on the Chime SDK?**
A: Treating it as a ready-made meeting application rather than infrastructure — expecting a pre-built UI, automatic cleanup of meeting resources, or broad default IAM access instead of explicitly managing meeting/attendee lifecycle and scoping IAM permissions to only the specific `chime-sdk-meetings`/`chime-sdk-voice` actions the application actually needs.

## Related Topics
- [api-gateway.md](./api-gateway.md)
- [lambda.md](./lambda.md)
- [iam.md](./iam.md)
- [sns.md](./sns.md)
