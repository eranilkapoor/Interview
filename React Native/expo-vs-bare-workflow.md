# Expo Managed Workflow vs Bare React Native

Expo is a set of tools, libraries, and cloud services built on top of React Native, and historically it offered two distinct project types: the **managed workflow**, where Expo owns the native iOS/Android project entirely — you never see an `ios/` or `android/` folder, you write JS/TypeScript and a `app.json` config, and Expo's build service (or, in the past, `expo build`) generates the native project and produces your app binary — and the **bare workflow**, a standard React Native project (generated via `npx react-native init` or ejected from managed) where you own the native folders directly, can add any native module or write custom native code freely, but lose Expo's "you never touch native code" simplicity and have to run your own native builds locally or via CI. The core appeal of managed was speed and simplicity: install Expo Go on a physical device, scan a QR code, and see your app running in seconds, with no Xcode/Android Studio setup required at all.

That strict binary — either fully managed with no native code access, or fully bare with the native folders checked into your repo — has substantially blurred in modern Expo. The current model centers on **prebuild** (also called continuous native generation, or CNG): rather than the native `ios/`/`android/` folders being a permanent, hand-edited part of your repo, they're treated as a *build artifact*, generated on demand from your `app.json`/`app.config.js` configuration plus any **config plugins** you've applied, and typically gitignored. Running `npx expo prebuild` generates those folders fresh from your config; you can run it locally when you need to inspect or add native code, and CI/EAS Build can run it automatically as part of a cloud build without you ever needing the folders checked in at all. This means you get most of managed's simplicity (no native folders to maintain by hand, config-driven native project generation) while still being able to add genuinely custom native modules — either by writing a config plugin (a JS function that programmatically modifies the generated native project during prebuild — e.g., adding a permission string to `Info.plist`, or linking a native SDK) or by running prebuild once, hand-editing the generated native code, and committing the result (at which point you're effectively back to a bare-style workflow for that project).

The other major piece of Expo's value proposition is **EAS** (Expo Application Services): **EAS Build** runs native iOS/Android builds in the cloud (so you don't need a Mac to build for iOS, and don't need to maintain local build toolchains at all), **EAS Submit** automates uploading built binaries to the App Store/Play Store, and **EAS Update** provides **over-the-air (OTA) updates** — the ability to push a new JS bundle (and any co-located assets) directly to users' installed apps without going through app-store review, as long as the change doesn't touch native code (a bug fix in a component, a copy change, a new screen built from existing native capabilities all qualify; adding a new native module does not, since that requires a new native binary). OTA updates are one of Expo's most practically valuable features for shipping fast, but it's worth knowing they only cover the JS layer — anything requiring new native code genuinely needs a new build and a store submission, OTA or not.

For working with custom native code during development without the friction of a full production build, Expo provides **development builds** (`expo-dev-client`): essentially a custom version of the Expo Go app, built specifically for your project, that includes whatever native modules/config plugins your project actually uses, while still giving you Expo Go-like fast refresh and JS-only iteration for everyday work. This replaces the older, one-way "eject" concept (which used to mean permanently converting a managed project into a bare one, with no going back) — prebuild is regenerable and non-destructive, so a modern Expo project can add native code, remove it, or reconfigure it without a point of no return. In practice, the decision of "Expo or bare React Native" today is less "which framework" and more "how much do I want Expo's tooling (EAS, prebuild, config plugins, the managed library ecosystem) to own my native project generation" — most new React Native projects, including ones that will eventually need substantial custom native code, reasonably start with Expo and lean on prebuild/dev clients as needs grow, since it's a de facto superset of a bare project's capabilities plus its own tooling on top.

## Examples

A minimal Expo project's configuration file drives native project generation via prebuild — no `ios/`/`android/` folders need to exist in the repo at all:

```json
// app.json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "jsEngine": "hermes",
    "newArchEnabled": true,
    "ios": { "bundleIdentifier": "com.example.myapp" },
    "android": { "package": "com.example.myapp" },
    "plugins": [
      // Config plugins modify the generated native project during prebuild
      ["expo-camera", { "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera" }],
      ["expo-build-properties", { "ios": { "deploymentTarget": "15.1" } }]
    ]
  }
}
```

Running prebuild locally shows the "config in, native project out" model concretely:

```
# Regenerates ios/ and android/ from app.json + installed config plugins.
# These folders are typically gitignored — they're a build artifact, not source of truth.
npx expo prebuild --clean

# Then run natively as needed, same as any React Native project:
npx expo run:ios
npx expo run:android
```

EAS Update ships a JS-only bug fix directly to users without an app-store review cycle — a concrete illustration of what OTA updates can and can't cover:

```
# Publishes the current JS bundle to the "production" channel.
# Users with the app installed receive it on next launch/foreground check —
# no App Store / Play Store review needed, because no native code changed.
eas update --branch production --message "Fix incorrect discount calculation on checkout"

# This would NOT be sufficient if the fix required a new native module —
# that requires a new native build via `eas build` and a fresh store submission.
```

## Common Pitfalls / Gotchas

- Assuming "Expo" still strictly means "no native code access" — that was true of the old managed workflow model, but modern Expo (prebuild + config plugins + dev builds) supports arbitrary custom native code.
- Trying to test a native module (camera, custom native SDK, etc.) inside the plain Expo Go app — Expo Go only includes the native modules Expo ships by default; anything else requires a development build (`expo-dev-client`) built for your specific project.
- Forgetting that EAS Update (OTA) cannot ship native code changes — pushing an update that references a new native module without a corresponding new native build will crash or silently fail for users on the old binary.
- Committing the generated `ios/`/`android/` folders to git and then also hand-editing them directly, while still running `expo prebuild` in CI — prebuild will overwrite those manual edits unless they're captured as a config plugin instead.
- Treating "eject" as still the right mental model — the old one-way, no-going-back eject process has been superseded by prebuild, which is regenerable and reversible; using outdated "ejecting" terminology/tutorials can lead to unnecessarily destructive workflows.

## Interview Questions & Answers

**Q: What's the practical difference between the old managed/bare split and how Expo works today?**
A: The old model was a strict binary: managed meant Expo owned the native project with no code access, bare meant you owned hand-maintained native folders with full access but none of Expo's tooling. Today, prebuild treats the native folders as a regenerable build artifact driven by your config and config plugins, so a single project can have full native code access (via config plugins or by editing generated native code) while still using Expo's tooling — the strict either/or choice mostly no longer applies.

**Q: What is a config plugin, concretely?**
A: A JS function (or reference to one from a library) that Expo's prebuild process runs against the generated native project to apply a specific native-level change programmatically — for example, adding a permission usage string to `Info.plist`, modifying `AndroidManifest.xml`, or linking a native SDK's build configuration. It lets you express native project customizations in a declarative, regenerable, version-controllable way instead of hand-editing native files that prebuild would otherwise overwrite.

**Q: What can and can't EAS Update (OTA updates) actually ship to users?**
A: It can ship anything that's pure JS/TypeScript and co-located assets — bug fixes, new screens built from already-available native capabilities, copy/styling changes — directly to installed apps without app-store review. It cannot ship anything requiring new native code (a new native module, an Info.plist/AndroidManifest change, a new native permission) — that always requires a new native binary built via EAS Build and, typically, a new store submission.

**Q: When would you still reach for a fully bare (non-Expo) React Native project today?**
A: It's a much narrower case than it used to be, since prebuild covers most custom-native-code needs, but teams sometimes choose bare when they want to hand-maintain native project files directly without any config-plugin abstraction layer, need extremely fine-grained control over native build tooling/CI outside EAS, or are migrating a large pre-existing native app incrementally and don't want Expo's config-driven native generation model at all.

**Q: What replaced the old "eject" workflow, and why is that an improvement?**
A: Prebuild (continuous native generation) replaced eject. Eject used to be a one-way conversion — once you ejected a managed project to bare, there was no clean way back. Prebuild instead regenerates the native folders from config on demand, non-destructively, so adding, removing, or reconfiguring native code is a repeatable, reversible operation rather than a one-time irreversible migration.

## Related Topics
- [introduction-to-react-native.md](./introduction-to-react-native.md)
- [native-modules.md](./native-modules.md)
- [building-and-releasing-apps.md](./building-and-releasing-apps.md)
- [permissions-handling.md](./permissions-handling.md)
- [push-notifications.md](./push-notifications.md)
