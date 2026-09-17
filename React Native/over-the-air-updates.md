# Over-the-Air (OTA) Updates

Over-the-air updates let you push a new JavaScript bundle (and its associated assets, like images) directly to users' devices without going through App Store or Play Store review at all. Because React Native's application logic — components, business logic, navigation, styling — lives in a JS bundle that's interpreted/executed by the JS engine at runtime rather than compiled into the native binary, that bundle can, in principle, be swapped out after the app is already installed, the same way a web page can be updated by just changing the files a browser fetches. This is the single biggest release-velocity advantage React Native has over fully native development: a critical bug fix or a copy change can reach users in minutes instead of waiting days for store review.

The two dominant OTA tools are **CodePush** (Microsoft, originally standalone, later folded into App Center, which Microsoft has announced it is sunsetting/retiring — teams are actively migrating off it) and **Expo EAS Update** (Expo's actively maintained modern replacement, working for both Expo-managed and bare React Native projects that adopt Expo modules). Both work on the same fundamental principle: the native app shell ships with a small runtime (`react-native-code-push` or `expo-updates`) that, on launch or in the background, checks a remote server for a newer JS bundle matching the currently installed native binary, downloads it if present, and swaps it in — either immediately or on the next app restart, depending on configuration.

The critical boundary to understand — and the thing interviewers most want to hear articulated precisely — is **what OTA can and cannot update**. It can update: JS/TS application code, static JS-bundled assets (images, fonts referenced via `require`), and styling/logic that doesn't require new native code. It categorically **cannot** update: any native code change (new Swift/Kotlin/Objective-C/Java files, changes to `Info.plist` or `AndroidManifest.xml`), the addition of a new native dependency (a new native module needs its native code linked into the binary at build time — you can't inject a new native module via a JS-only OTA push), and new or changed permissions (a permission the binary didn't declare and request-flow for at build time can't be granted retroactively by pushing JS). Any of these requires a full native rebuild and a fresh store submission — OTA is strictly a JS/assets-layer mechanism sitting on top of a fixed native binary "shell."

Because of that boundary, OTA systems need a **compatibility/versioning model** tying a JS bundle to the native binary version(s) it's safe to run on. CodePush and EAS Update both let you target a release at a specific native app version (or version range) so that, say, a JS bundle assuming a new native module exists never gets delivered to an older binary that doesn't have it — delivering an incompatible bundle to the wrong binary is a classic way to crash every user's app at once. Rollout strategy matters just as much: both tools support **staged/percentage rollouts** (release to 10% of users, watch crash-rate/error telemetry, then ramp to 50%, then 100%) rather than pushing to 100% of the install base instantly, plus a **rollback mechanism** to immediately revert everyone to the last known-good bundle if a bad release starts causing crashes. It's worth being explicit in an interview that OTA updates are not a safety net against bugs — a bad OTA-pushed bundle is still just as capable of crashing the app or corrupting local state as a bad build submitted through the store, because it's still real, arbitrary JavaScript executing with full access to the app's runtime; OTA changes *how fast* a bug can reach and be pulled back from users, not whether bugs can happen.

## Examples

```bash
# CodePush: releasing a JS-only update targeting a specific native binary range
appcenter codepush release-react \
  -a MyOrg/MyApp-iOS \
  -d Production \
  --targetBinaryVersion "~2.3.0" \
  --rollout 20
# --rollout 20 means only 20% of eligible devices receive this release initially;
# --targetBinaryVersion pins it to native binary 2.3.x so older/newer shells never get an incompatible bundle
```

```js
// CodePush: wiring the app to check for and apply updates, with a rollback-safe sync strategy
import codePush from 'react-native-code-push';

const codePushOptions = {
  checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
  installMode: codePush.InstallMode.ON_NEXT_RESTART, // don't hot-swap mid-session
  mandatoryInstallMode: codePush.InstallMode.IMMEDIATE, // critical fixes apply right away
};

function App() {
  return <RootNavigator />;
}

export default codePush(codePushOptions)(App);
```

`ON_NEXT_RESTART` avoids yanking the JS bundle out from under a user mid-session (which can produce inconsistent UI state), while a `mandatory` release — typically used for a severe bug fix — installs immediately instead of waiting.

```json
// app.json (Expo EAS Update) — runtimeVersion ties JS updates to a compatible native build
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/your-project-id"
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    }
  }
}
```

```bash
# EAS Update: publish a JS update to the "production" channel, then roll back if telemetry looks bad
eas update --branch production --message "Fix checkout crash"
eas update:roll-back-to-embedded --branch production
```

`runtimeVersion` is EAS Update's compatibility guard: a published update is only offered to installed binaries whose native runtime version matches, which is what prevents a JS update written against a new native module from ever reaching a binary that was built without it.

## Common Pitfalls / Gotchas

- Assuming OTA can ship a new native dependency (e.g., adding `react-native-camera` for the first time) — it can't; any new native code requires a full rebuild and store resubmission, since OTA only ever replaces the JS bundle running inside the existing native shell.
- Pushing an OTA update with no `targetBinaryVersion`/`runtimeVersion` constraint, so a JS bundle written against a newer native API surface gets delivered to an older binary still in the wild and crashes it on launch.
- Treating OTA as a way to skip store review entirely for changes that actually touch permissions or native behavior — Apple in particular has guidelines against using OTA mechanisms to substantively alter the app outside of what was reviewed, and CodePush/EAS updates that appear to circumvent review scope can trigger policy issues.
- Forgetting that a bad OTA bundle is just as capable of crashing the app as a bad native build — OTA speeds up *distribution* and *rollback*, it does not make the pushed code any safer or more tested.
- Not testing the update-and-restart flow itself — some `installMode` configurations swap the bundle silently on next launch, which can surprise users mid-task or wipe in-memory state they expected to persist if the transition isn't handled carefully.
- Relying on CodePush going forward without a migration plan — Microsoft has announced the sunsetting of App Center (which CodePush depends on), so teams still on it need to plan a move to EAS Update or a self-hosted alternative rather than assuming it'll be supported indefinitely.

## Interview Questions & Answers

**Q: What categories of changes can and cannot be shipped via OTA update?**
A: OTA can ship anything that lives purely in the JS bundle or its bundled static assets — application logic, component code, styling, images referenced via `require`, copy changes, bug fixes in JS. It cannot ship any change requiring new or modified native code: new native dependencies/modules, changes to native permissions declared in `Info.plist`/`AndroidManifest.xml`, or anything requiring a different native binary altogether. Those changes require a full rebuild and a new store submission, because the OTA mechanism only ever replaces the JS layer running inside an already-installed native shell.

**Q: Why do OTA tools tie a release to a specific native binary version instead of just pushing the latest JS bundle to everyone?**
A: Because a JS bundle can assume the presence of native APIs, native modules, or behavior that only exists in certain binary versions — pushing that bundle to an older binary that lacks the assumed native surface would crash the app immediately on load. Version targeting (CodePush's `targetBinaryVersion`, EAS Update's `runtimeVersion`) ensures a JS release is only offered to binaries it's actually compatible with, which is a compatibility contract, not just a convenience feature.

**Q: How does staged rollout reduce the risk of an OTA update, and what would make you halt one?**
A: Instead of pushing to 100% of the install base immediately, a staged rollout releases to a small percentage first (e.g., 10–20%), and you watch crash-rate and error-tracking telemetry (Sentry, Crashlytics, or the OTA provider's own metrics) before ramping further. You'd halt and roll back if crash rates spike, if key user flows start erroring, or if any regression shows up in that percentage that wasn't caught in QA — the whole point is limiting the blast radius of a bad release to a fraction of users instead of everyone at once.

**Q: Is it true that OTA updates bypass app store review entirely, and are there risks to that?**
A: It's true in the narrow sense that a JS-only OTA push doesn't go through a new store review cycle, which is exactly why it's fast. But the risk is real: OTA is still shipping and executing arbitrary code on users' devices, so a broken or malicious update is just as dangerous as a broken native release, just without the review checkpoint acting as a safety net. Both Apple's and Google's policies also constrain how far OTA mechanisms can be used to change an app's actual behavior versus what was reviewed, so teams need their own release discipline (staged rollout, monitoring, rollback readiness) to compensate for not having that external check.

**Q: Why is Microsoft sunsetting CodePush/App Center relevant to a team choosing an OTA strategy today?**
A: Since CodePush is built on top of App Center, and Microsoft has announced App Center's retirement, teams still depending on CodePush need an active migration plan rather than treating it as a stable long-term choice — new projects are generally better served starting on an actively maintained alternative like Expo EAS Update (which works with bare React Native projects too, not just Expo-managed ones) to avoid an unplanned migration later.

## Related Topics
- [building-and-release.md](./building-and-release.md)
- [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [hermes-engine.md](./hermes-engine.md)
- [security-in-react-native.md](./security-in-react-native.md)
