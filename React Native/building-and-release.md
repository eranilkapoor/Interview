# Building and Release

Shipping a React Native app to end users means producing two separate native binaries — an iOS `.ipa` and an Android `.apk`/`.aab` — through two entirely different toolchains, each with its own signing model, store review process, and failure modes. Unlike a web deploy, which is "push files to a server," a mobile release is a multi-day-to-multi-week pipeline: build, sign, upload to a testing track, get reviewed by the platform, then get reviewed again for the production release. Understanding this pipeline concretely (not just "you run `expo build`") is what separates candidates who've shipped a real app from those who've only run `npx react-native run-ios` in development.

On iOS, the build is produced by Xcode's build system, either through the Xcode GUI (Product > Archive) or headlessly via `xcodebuild archive` (which is what CI pipelines use). An archive is a fully built, signed `.xcarchive` bundle containing the app binary plus dSYM debug symbols. Signing on iOS requires two paired artifacts from the Apple Developer portal: a **signing certificate** (proves the identity of the developer/organization, installed in the macOS Keychain) and a **provisioning profile** (a file that ties together the certificate, the app's bundle identifier, allowed entitlements like push notifications or associated domains, and — for development/ad-hoc profiles — a whitelist of registered device UDIDs). A build signed with a Development profile only runs on whitelisted devices; a build signed with a Distribution profile is required for TestFlight and App Store submission. Once archived, `xcodebuild -exportArchive` produces the `.ipa`, which is uploaded to App Store Connect via Xcode Organizer, `xcrun altool`, or `xcrun notarytool`/Transporter. From there it can be distributed internally or externally through **TestFlight** (Apple's beta distribution platform, supporting up to 10,000 external testers with builds that expire after 90 days) before being submitted for **App Store Review** — a human and automated review process that typically takes anywhere from a few hours to a few days and can reject an app for reasons ranging from crashes to policy violations (e.g., using private APIs, incomplete metadata, or guideline violations around in-app purchases).

On Android, the build is produced by Gradle, React Native's build tool for the native Android project. `./gradlew assembleRelease` produces a signed `.apk` (a traditional installable package), while `./gradlew bundleRelease` produces an `.aab` (Android App Bundle) — the format Google Play has required for new apps since 2021. The key difference: an APK is a single monolithic package containing resources for every device configuration (all screen densities, all CPU architectures), while an AAB is a publishing format that Play Console uses to generate and serve optimized, device-specific APKs at install time (smaller downloads, since a user's device only gets the `arm64` native libraries and `xxhdpi` assets it actually needs, not every variant). Signing on Android uses a **keystore** — a file containing a private key generated with `keytool`, referenced in `android/app/build.gradle` via `signingConfigs`, with the keystore path/passwords typically injected via `gradle.properties` or environment variables in CI rather than committed to source control. Since 2021, Google strongly pushes **Play App Signing**, where Google holds and manages the actual app-signing key on your behalf; you sign your upload with a separate "upload key," and Google re-signs the final artifact with the app signing key it holds — this protects you if your upload key is ever compromised, since Google's held key never leaves their infrastructure. Play Console then supports staged rollouts (releasing to a percentage of users first) and review, which is generally faster and more automated than Apple's.

**Fastlane** is the tool most real teams use to automate both pipelines from one place instead of clicking through Xcode and Play Console by hand. It's a Ruby-based CLI with platform-specific "lanes" (scripts) defined in a `Fastfile` — a typical `fastlane ios release` lane might bump the build number, run `xcodebuild` via the `gym` action, and upload to TestFlight via `pilot`, while `fastlane android release` runs `gradlew bundleRelease` and uploads to Play Console via `supply`. Fastlane also automates App Store/Play Store screenshots (`snapshot`/`screengrab`) and metadata updates. Its most valuable sub-tool for teams is **`fastlane match`**, which solves the perennial pain of iOS certificate/provisioning-profile management: instead of every developer generating their own certs (which Apple limits and which expire), `match` generates one shared set of certificates and profiles, encrypts them, and stores them in a private git repo (or cloud storage), so any machine — a developer's laptop or a CI runner — can decrypt and install exactly the right signing identity with one command, eliminating "works on my machine" signing failures in CI.

## Examples

```bash
# iOS: headless archive + export, the CI equivalent of Xcode's Product > Archive
xcodebuild -workspace ios/MyApp.xcworkspace \
  -scheme MyApp \
  -configuration Release \
  -archivePath build/MyApp.xcarchive \
  archive

xcodebuild -exportArchive \
  -archivePath build/MyApp.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist ios/ExportOptions.plist
# ExportOptions.plist specifies method: app-store, ad-hoc, development, or enterprise,
# and which provisioning profile/signing identity to use for the export.
```

This is what most CI systems run under the hood — Xcode Cloud, Fastlane's `gym`, and Bitrise all wrap this same `xcodebuild archive` / `-exportArchive` sequence.

```bash
# Android: build both formats and see where the signing config gets applied
cd android
./gradlew bundleRelease   # produces app/build/outputs/bundle/release/app-release.aab (Play Store)
./gradlew assembleRelease # produces app/build/outputs/apk/release/app-release.apk (sideload/direct distribution)
```

```groovy
// android/app/build.gradle — signing config referencing a keystore via env vars,
// never committing real passwords to source control
android {
    signingConfigs {
        release {
            storeFile file(System.getenv("MYAPP_UPLOAD_STORE_FILE") ?: "release.keystore")
            storePassword System.getenv("MYAPP_UPLOAD_STORE_PASSWORD")
            keyAlias System.getenv("MYAPP_UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("MYAPP_UPLOAD_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
        }
    }
}
```

```ruby
# fastlane/Fastfile — one command drives both TestFlight and Play internal-track uploads
platform :ios do
  lane :beta do
    match(type: "appstore")               # fetch shared certs/profiles from the match git repo
    increment_build_number
    build_app(scheme: "MyApp")
    upload_to_testflight
  end
end

platform :android do
  lane :beta do
    gradle(task: "bundleRelease")
    upload_to_play_store(track: "internal")
  end
end
```

This shows the point of Fastlane: `fastlane ios beta` and `fastlane android beta` become the entire release ritual, runnable identically by a developer locally or by CI, instead of two divergent manual processes.

## Common Pitfalls / Gotchas

- Confusing the **upload key** with the **app signing key** under Play App Signing — losing your upload key is recoverable (Google can help you reset it), but historically losing the actual app signing key (pre-Play App Signing) meant you could never update that app again.
- Letting a provisioning profile or distribution certificate expire without noticing — CI builds that were passing suddenly fail signing with cryptic Xcode errors, and this is one of the most common reasons a scheduled release build silently breaks.
- Shipping an APK to Play Console when it now requires an AAB for new apps/updates, or not realizing the two produce different install-time behavior (AAB requires Play Core / dynamic delivery understanding for advanced features like on-demand modules).
- Committing a keystore file or its passwords to a public repo — the keystore is a long-lived secret; if committed, it should be treated as compromised and rotated (which, without Play App Signing, can be catastrophic).
- Forgetting to bump the build number (iOS `CFBundleVersion`) or `versionCode` (Android) before a new submission — both stores reject a re-upload with a version number they've already seen.
- Assuming TestFlight and App Store production builds are identical — a build can pass TestFlight distribution but still get rejected in full App Store Review, since TestFlight's review is a lighter-weight beta-app check, not the full guideline review.

## Interview Questions & Answers

**Q: What's the difference between an APK and an AAB, and why does Google Play require AAB now?**
A: An APK is a single, complete installable package bundling resources for every supported device configuration — every screen density and every CPU architecture — which makes it larger than necessary for any individual device. An AAB (Android App Bundle) is not directly installable; it's a publishing format Play Console uses to dynamically generate and serve a smaller, device-specific APK at install time, so a user only downloads the resources their exact device needs. Google requires AAB for new app submissions because it meaningfully reduces download size across their whole user base and enables features like dynamic feature modules.

**Q: Explain what a provisioning profile does on iOS and why it's separate from the signing certificate.**
A: The certificate proves *who* built the app (the developer or organization's cryptographic identity, held in the Keychain), while the provisioning profile ties that identity to *what* the app is allowed to do — which bundle identifier it can be built for, which entitlements (push notifications, associated domains, etc.) are enabled, and for development/ad-hoc profiles, which specific device UDIDs are allowed to install it. They're separate because the same certificate might be used across many apps with different entitlement needs, and profiles need to be swapped or regenerated (e.g., adding a new device) far more often than the certificate itself.
 
**Q: What problem does `fastlane match` solve that plain certificate management doesn't?**
A: Without `match`, every developer machine and every CI runner needs its own valid signing certificate and provisioning profile, and Apple limits how many certificates can be active at once — so teams commonly hit "too many certificates" errors or have builds fail because a teammate's local Xcode silently regenerated a profile. `match` centralizes one shared set of certificates and profiles, encrypts them, and stores them in a private repo, so every machine decrypts and installs the exact same signing identity on demand, making signing reproducible across the whole team and CI rather than machine-specific.

**Q: What's the practical difference between TestFlight review and full App Store Review?**
A: TestFlight's review (for external testers) is a lighter check focused mainly on crashes and obviously malicious/broken behavior, and it's usually much faster — sometimes near-instant for internal testers, hours for external. Full App Store Review evaluates the complete App Store Review Guidelines: metadata accuracy, privacy nutrition labels, in-app purchase compliance, design guideline adherence, and more, and can reject an app that sailed through TestFlight without issue. Passing TestFlight is not a guarantee of passing store review.

**Q: Why would a team choose Play App Signing instead of managing their own upload keystore end-to-end?**
A: With Play App Signing, Google holds the actual key used to sign the final artifact users download, while the developer only needs to protect an upload key used to authenticate uploads to Play Console. If the upload key is ever lost or compromised, Google can help reset it because they still control the real signing key — whereas under the old self-managed model, losing the one keystore that signed your app permanently prevented you from shipping updates to that same app listing, since Play would reject any APK not signed with the original key.

## Related Topics
- [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md)
- [over-the-air-updates.md](./over-the-air-updates.md)
- [app-permissions.md](./app-permissions.md)
- [security-in-react-native.md](./security-in-react-native.md)
- [react-native-architecture.md](./react-native-architecture.md)
