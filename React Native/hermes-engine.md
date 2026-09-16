# Hermes Engine

Hermes is an open-source JavaScript engine built by Meta specifically for React Native, first released in 2019 and now the default JS engine for React Native apps on both iOS and Android. Like any JS engine — JavaScriptCore (JSC), V8, or Hermes — its job is to take JavaScript source and actually execute it, but Hermes was designed from the ground up around the specific constraints of mobile apps rather than being a general-purpose engine repurposed for mobile, which is effectively what happened with JSC (originally built for Safari/WebKit) and V8 (originally built for Chrome/Node.js) when they were used to power React Native. That mobile-first design is where all of Hermes's practical advantages come from.

The single biggest architectural difference is **when parsing and compilation happen**. JSC and V8, used in their typical configuration, parse and compile your JavaScript bundle's source text into bytecode (and, for V8, potentially further JIT-compile hot code into machine code) *at app startup*, every time the app launches — this is fast on a powerful desktop/server CPU but measurably slow on a mobile device, especially for a large JS bundle, and it directly delays Time to Interactive (TTI), the point at which the app is actually usable. Hermes instead performs **ahead-of-time (AOT) compilation**: during your app's build process, the entire JS bundle is precompiled into Hermes's own optimized bytecode format and that bytecode is what actually ships inside the app binary. At runtime, Hermes simply loads and executes already-compiled bytecode directly — there's no parsing of raw JS text and no compilation step happening on the user's device at launch, which is the core reason Hermes apps start up meaningfully faster than the same app running on JSC.

Beyond startup time, precompiling to bytecode ahead of time also produces a **smaller app size** in many cases — Hermes bytecode is generally more compact than shipping raw (even minified) JS source plus whatever the engine needs to parse it — and **lower runtime memory usage**, partly because Hermes was deliberately engineered with a small memory footprint as a design goal (important on lower-end Android devices with limited RAM, which was a major original motivation for building Hermes) and partly because AOT compilation avoids keeping around the intermediate data structures a just-in-time parser/compiler needs while it works. Hermes also ships its own **garbage collector**, purpose-built and tuned for the allocation patterns typical of React Native apps (lots of short-lived objects from frequent re-renders), rather than reusing a GC designed for a different runtime's typical workload.

It's worth being clear about tradeoffs rather than treating Hermes as strictly superior in every dimension: because Hermes skips JIT compilation of hot paths at runtime (unlike V8's tiered JIT), extremely computation-heavy, long-running JS (rare in typical UI-driven mobile app code, but possible in things like heavy client-side data processing) can in principle run slower on Hermes than on a fully JIT-optimizing engine — the tradeoff favors fast startup and low memory over peak long-run throughput, which is the right tradeoff for the vast majority of mobile app code. In practice, Hermes has been the default JS engine for new React Native projects since React Native 0.70, is deeply integrated with the New Architecture (JSI is implemented in Hermes), and is what both bare React Native and Expo projects use unless explicitly configured otherwise — see [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md) and [react-native-architecture.md](./react-native-architecture.md) for how Hermes fits into the broader architecture.

## Examples

Enabling (or confirming) Hermes is a build-configuration concern, not application code — but it's worth knowing what that configuration looks like:

```gradle
// android/app/build.gradle (bare React Native) — Hermes is the default; this is how it's set explicitly
project.ext.react = [
    enableHermes: true
]
```

```json
// app.json (Expo) — Hermes is the default JS engine in modern Expo SDKs
{
  "expo": {
    "jsEngine": "hermes"
  }
}
```

You can confirm which engine is running at runtime, which is a common debugging step when diagnosing performance differences between environments:

```jsx
import { Text } from 'react-native';

function EngineBadge() {
  // HermesInternal is only defined when the JS is running on Hermes
  const isHermes = () => !!global.HermesInternal;

  return <Text>Running on: {isHermes() ? 'Hermes' : 'JSC / V8'}</Text>;
}
```

Hermes ships a bytecode precompiler as part of the React Native build tooling; inspecting the produced bundle shows the AOT step concretely (illustrative CLI usage):

```
# Produces a Hermes bytecode bundle instead of shipping raw/minified JS text
npx react-native bundle \
  --platform android \
  --dev false \
  --bundle-output index.android.bundle \
  --minify true
# With Hermes enabled, this bundle is compiled to Hermes bytecode as part of the
# native build (via the hermesc compiler), not shipped as parseable JS source.
```

## Common Pitfalls / Gotchas

- Assuming Hermes makes *all* JS code faster — it primarily improves startup time, app size, and memory footprint; long-running, computation-heavy JS can in some cases run slower than on a fully JIT-optimizing engine like V8.
- Forgetting that some npm packages historically shipped JS relying on JSC-specific or V8-specific global behavior (subtle spec-edge-case differences, `Intl` API completeness in older Hermes versions) — mostly resolved in modern Hermes, but worth knowing as a historical source of "works on iOS/JSC, breaks on Android/Hermes" bugs.
- Debugging tooling differences — Hermes uses its own debugger protocol/dev tools integration (via Chrome DevTools' Hermes support or Flipper), which can behave differently from debugging directly against JSC.
- Not realizing Hermes bytecode is engine-specific — you can't take a Hermes-compiled bundle and run it on JSC or V8; the AOT compilation step is tied to Hermes's own bytecode format.
- Assuming Hermes is Android-only — this was true in Hermes's early days but it has supported iOS as a fully first-class target for years now, and is the default engine on both platforms in modern React Native.

## Interview Questions & Answers

**Q: What is the single biggest difference between how Hermes and JSC handle a JS bundle at app launch?**
A: JSC parses and compiles the JS bundle's source text into bytecode at app startup, every launch, which costs real time on a mobile CPU. Hermes precompiles the entire bundle to its own bytecode format ahead of time, during the build, so at launch it just loads and directly executes already-compiled bytecode — no parsing or compilation happens on the device at startup, which is the main driver of Hermes's faster Time to Interactive.

**Q: Why does AOT compilation also tend to reduce app size?**
A: Precompiled Hermes bytecode is generally more compact than shipping raw or minified JavaScript source text, since the engine doesn't need to embed enough information to parse arbitrary JS syntax on-device — the parsing/compilation work, and the intermediate representations it would need, already happened at build time and only the final compact bytecode ships in the app binary.

**Q: Is there any downside to Hermes compared to a JIT-optimizing engine like V8?**
A: Yes — Hermes intentionally favors fast startup and low memory usage over peak execution throughput for long-running, computation-heavy code, since it doesn't do the kind of tiered JIT optimization V8 does for hot code paths. For typical UI-driven mobile app code this tradeoff is clearly favorable, but a workload doing heavy sustained computation in JS could in principle run faster on a JIT-optimizing engine.

**Q: How does Hermes's garbage collector differ from a general-purpose engine's GC?**
A: Hermes ships its own GC, purpose-tuned for the allocation patterns typical of React Native apps — notably lots of short-lived object allocations from frequent component re-renders — rather than reusing a GC designed primarily for a different runtime's typical workload (like long-running server processes for V8/Node, or general web page workloads for JSC). This tuning contributes to Hermes's lower memory footprint on resource-constrained mobile devices.

**Q: Is Hermes required to use React Native's New Architecture?**
A: Hermes isn't strictly required — JSI can be implemented by other engines — but Hermes is the default, most tightly integrated, and most thoroughly tested engine for the New Architecture, and JSI is implemented natively in Hermes. In practice, nearly all modern React Native and Expo projects use Hermes together with the New Architecture (Fabric/TurboModules) as the standard, well-supported combination.

## Related Topics
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [react-native-architecture.md](./react-native-architecture.md)
- [performance-optimization.md](./performance-optimization.md)
- [debugging-react-native-apps.md](./debugging-react-native-apps.md)
- [building-and-releasing-apps.md](./building-and-releasing-apps.md)
