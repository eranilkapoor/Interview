# Security in React Native

Mobile app security has a different threat model from a typical web backend: the attacker has the entire app binary in their hands, can run it on a device they fully control (including rooted/jailbroken devices, emulators, and debuggers), and has effectively unlimited time to inspect it offline. Nothing shipped inside the app bundle — JS source, bytecode, native binaries, embedded config — can be treated as secret in the way a server-side environment variable can, because "secret" implies the attacker can't read it, and on a device the attacker owns, they eventually can. Good React Native security practice isn't about making the app bundle unreadable (impossible); it's about making sure the *actual* secrets — user credentials, session tokens, API keys with real privileges — never live in a place the attacker can extract them from, and about raising the cost of tampering and reverse engineering as a defense-in-depth layer, not a guarantee.

**Secure storage** is the first concrete line of defense: tokens, credentials, and any sensitive session data should go through `react-native-keychain`, which wraps the iOS Keychain and Android Keystore — both OS-level, hardware-backed (on supported devices) encrypted stores designed specifically for credential storage, optionally gated behind biometric authentication (Face ID/Touch ID, fingerprint) via `accessControl` options. This is explicitly *not* what `AsyncStorage` is for — AsyncStorage persists data as plaintext files on disk with no encryption at all (see `async-storage.md`), so an auth token written with `AsyncStorage.setItem` is readable by anyone with file-system access to the device (trivial on a rooted/jailbroken device, and achievable via backup extraction tools even on some non-rooted ones). The distinction interviewers look for: AsyncStorage is for non-sensitive app state (preferences, cached UI data); Keychain/Keystore-backed storage is for anything that would be damaging if read by an attacker.

**Certificate/SSL pinning** defends against a specific attack: a man-in-the-middle intercepting HTTPS traffic using a rogue or compromised CA certificate (something that becomes plausible on a compromised device with a malicious root cert installed, or on a network with a corporate/attacker-controlled proxy). Normal TLS validates that the server's certificate chains up to *any* trusted CA; pinning goes further and validates that the certificate (or its public key) matches a specific, hardcoded expected value baked into the app, so even a technically-valid-but-untrusted-for-this-purpose certificate is rejected. This is implemented via libraries like `react-native-ssl-pinning` or `TrustKit`(iOS)/`OkHttp` `CertificatePinner` (Android)-based native config, or increasingly via platform-level config (iOS App Transport Security exceptions, Android Network Security Config XML). The real operational cost of pinning is certificate rotation: if the pinned cert expires or is rotated server-side without an app update pinning the new one, the app can lock itself out of its own API — so pinning strategies usually pin an intermediate/CA-level cert with longer validity, or ship multiple pins (current + next), rather than pinning a single leaf certificate.

**Obfuscation and Hermes bytecode** are worth being precise about in an interview: they raise the *cost* of reverse engineering, not the *possibility*. A React Native JS bundle, whether shipped as plain JS text or compiled to Hermes bytecode, is still fundamentally a program the OS has to execute on the user's own device — it can always be extracted from the app binary and disassembled/decompiled with enough effort (tools exist for both plain JS bundles and Hermes bytecode). Hermes bytecode is meaningfully harder to read than un-minified JS source (no variable names, no comments, a different representation than source-level JS), and tools like `metro`'s minifier or dedicated JS obfuscators add friction on top of that — but none of this is real security, only mild deterrence. The one true security control is: **never embed a real secret in the bundle in the first place.** An API key embedded in JS (even Hermes-compiled) that grants meaningful server-side privileges (a paid third-party service key, an admin-scoped key, etc.) should be treated as fully public and compromised; anything requiring real authorization belongs behind a backend the app talks to, not baked into client code.

**Jailbreak/root detection** (via libraries like `jail-monkey`) checks device-level signals (unusual file paths, suspicious installed packages, ability to write outside the sandbox, debugger attachment) to flag that a device's security model has likely been weakened. It's useful as one signal among several — e.g., stepping up authentication requirements, declining to cache highly sensitive data locally, or logging the condition for fraud analysis in a banking app — but it is fundamentally a best-effort heuristic, not a guarantee: root/jailbreak detection can itself be bypassed by a sufficiently motivated attacker (hooking frameworks like Frida/Xposed specifically exist to intercept and spoof these checks), so it should never be the *only* thing standing between an attacker and a sensitive action.

## Examples

```js
// Storing an auth token: Keychain/Keystore (correct) vs AsyncStorage (wrong)
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// WRONG: plaintext on disk, readable on a rooted/jailbroken device or via backup extraction
async function badStoreToken(token) {
  await AsyncStorage.setItem('authToken', token);
}

// CORRECT: backed by iOS Keychain / Android Keystore, OS-level encrypted,
// optionally requiring biometric auth to read it back
async function storeTokenSecurely(token) {
  await Keychain.setGenericPassword('session', token, {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getStoredToken() {
  const credentials = await Keychain.getGenericPassword();
  return credentials ? credentials.password : null; // false if nothing stored
}

async function clearStoredToken() {
  await Keychain.resetGenericPassword();
}
```

`react-native-keychain`'s API is deliberately narrow (username/password-shaped storage) but maps directly onto the Keychain/Keystore's credential model; the `accessControl`/`accessible` options control both encryption-at-rest behavior and whether biometric confirmation is required before the value can be read back.

```js
// Certificate pinning with react-native-ssl-pinning-style config, and why
// rotation strategy matters
import { fetch as pinnedFetch } from 'react-native-ssl-pinning';

async function callSecureApi(payload) {
  return pinnedFetch('https://api.example.com/account', {
    method: 'POST',
    timeoutInterval: 10000,
    // Pin multiple certs (current + upcoming) so a planned server-side
    // rotation doesn't lock the already-shipped app out of its own API
    sslPinning: {
      certs: ['api-example-com-2026', 'api-example-com-2027-backup'],
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    // A pinning failure here likely means a MITM attempt (or a misconfigured
    // pin after a real cert rotation) — treat it as a hard failure, not a retry
    throw new Error(`Secure request failed pin validation: ${err.message}`);
  });
}
```

Pinning multiple certificates (current and next) is the standard mitigation against the biggest operational risk of pinning: a server-side certificate rotation silently breaking every already-installed copy of the app that only pinned the old cert.

```jsx
// Jailbreak/root detection as one signal feeding a step-up decision, not a hard gate
import JailMonkey from 'jail-monkey';
import { useEffect, useState } from 'react';

function useDeviceRiskSignal() {
  const [isCompromised, setIsCompromised] = useState(false);

  useEffect(() => {
    // isJailBroken() covers both iOS jailbreak and Android root detection
    setIsCompromised(JailMonkey.isJailBroken());
  }, []);

  return isCompromised;
}

function SensitiveScreen() {
  const isCompromised = useDeviceRiskSignal();

  if (isCompromised) {
    // Defense in depth: warn and restrict, but the server-side authorization
    // check for this action must still exist independently — this is a UX/
    // risk signal, not the actual security boundary
    return <RiskWarningBanner message="This device appears to be rooted or jailbroken." />;
  }
  return <AccountDetailsScreen />;
}
```

The detection result changes what the app *offers* to do (warn, restrict caching, require step-up auth) but the real authorization decision still has to be enforced server-side, since the check itself can be bypassed by a sufficiently motivated attacker using hooking frameworks.

## Common Pitfalls / Gotchas

- Storing auth tokens, refresh tokens, or any credential in `AsyncStorage` instead of `react-native-keychain` — AsyncStorage is unencrypted plaintext on disk on both platforms.
- Hardcoding a real, privileged API key directly in JS/TS source, assuming Hermes bytecode compilation or a minifier makes it "safe" — bytecode and minification add friction, not real protection; a key embedded in the shipped bundle should be treated as public.
- Pinning a single leaf certificate with no rotation plan — when the server's cert is renewed, every already-installed app version that pinned only the old cert breaks until users update, effectively a self-inflicted outage.
- Relying on jailbreak/root detection (or obfuscation) as the actual security boundary for a sensitive action, instead of treating it as a soft signal — both can be bypassed (Frida/Xposed-style hooking can spoof detection results), so the real authorization check must live server-side.
- Logging sensitive data (tokens, PII, full request/response bodies) via a console/network logging library left enabled in production builds — these logs are often readable on-device or shipped to third-party crash/analytics tools without the team realizing the payloads contain secrets.
- Trusting client-side validation or client-enforced business rules as a security control — anything enforced only in JS running on a device the attacker controls (price checks, permission checks, feature gating) can be bypassed by patching the running app or replaying modified requests directly against the API.

## Interview Questions & Answers

**Q: Why shouldn't you store an auth token in AsyncStorage?**
A: AsyncStorage persists data as unencrypted plaintext on disk on both iOS and Android — an unencrypted SQLite database on Android, flat files on iOS — so anyone with file-system access to the device (trivial on a rooted or jailbroken device, and achievable through backup-extraction tooling on some non-rooted ones) can read the token directly. `react-native-keychain` should be used instead, since it's backed by the iOS Keychain and Android Keystore, which provide OS-level, often hardware-backed encryption and can optionally require biometric authentication before the value is released.

**Q: Does obfuscating or minifying the JS bundle, or compiling to Hermes bytecode, make the app secure against reverse engineering?**
A: No — it raises the cost and difficulty of reverse engineering but doesn't make it impossible, because the bundle has to be executable on a device the attacker fully controls, and tooling exists to disassemble both plain JS bundles and Hermes bytecode. The practical implication is that no real secret (a privileged API key, hardcoded credentials, business logic that must not be tampered with) should be trusted to stay hidden inside the client bundle regardless of how it's compiled or obfuscated; genuinely sensitive operations need to be enforced server-side.

**Q: What is certificate pinning, what does it protect against, and what's the operational risk of using it?**
A: Certificate pinning has the app validate that the server's TLS certificate (or public key) matches a specific hardcoded value, in addition to normal certificate-chain trust validation, which defends against man-in-the-middle attacks using a rogue but technically-trusted certificate — for example, on a compromised device or an attacker-controlled network proxy. The main operational risk is certificate rotation: if the server's certificate changes and the app only pinned the old one, already-installed copies of the app get locked out of the API until they're updated, which is why teams typically pin at the intermediate/CA level or ship multiple pins (current and upcoming) rather than a single leaf certificate.

**Q: How reliable is jailbreak/root detection, and how should it factor into a security design?**
A: It's a useful heuristic signal — checking for unusual file paths, sideloaded packages, sandbox-escape capability, or debugger attachment — but it's not a guarantee, because the detection logic itself runs on the compromised device and can be intercepted or spoofed using hooking frameworks like Frida or Xposed by a motivated attacker. It belongs in a defense-in-depth strategy (stepping up authentication, limiting what sensitive data gets cached locally, flagging for fraud review) rather than being the sole gate on a sensitive action — the actual authorization decision for anything that matters needs to be enforced independently on the server.

**Q: A teammate wants to embed a third-party service's API key directly in the React Native app so the app can call that service directly. What would you tell them?**
A: I'd point out that anything shipped in the app bundle — whether plain JS or Hermes bytecode — is extractable by anyone with the app binary, so that key should be treated as effectively public the moment it ships, regardless of minification or obfuscation. If the key grants real privileges (billing, elevated data access, rate limits tied to your account), the safer pattern is to proxy that call through your own backend, which holds the real key server-side and can apply its own auth/rate-limiting to the app's requests instead of trusting the client with the credential directly.

## Related Topics
- [async-storage.md](./async-storage.md)
- [networking-and-api-calls.md](./networking-and-api-calls.md)
- [hermes-engine.md](./hermes-engine.md)
- [app-permissions.md](./app-permissions.md)
- [building-and-release.md](./building-and-release.md)
- [../React/error-boundaries.md](../React/error-boundaries.md)
