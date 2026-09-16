# React Native Architecture (Old vs New)

React Native has always run on three logically separate threads working together, and understanding *why* is the key to understanding both the old and new architecture. The **JavaScript thread** is where your React code actually executes — component rendering, state updates, the reconciler's diffing, your business logic. The **native/UI thread** (sometimes called the "main thread") is where the platform actually draws views to the screen and handles raw touch input — on both iOS and Android this is the same thread the OS reserves for UI work, and it must stay responsive or the app visibly janks. A third, less commonly discussed **Shadow thread** runs Yoga, React Native's C++ Flexbox layout engine, computing the position and size of every view off the main thread so that expensive layout math doesn't block UI rendering. These three threads necessarily need to communicate constantly — JS decides *what* the UI should look like, Yoga decides *where* everything goes, and the native thread actually draws it — and how that communication happens is exactly what changed between the old and new architecture.

In the **old architecture**, the JS thread and native thread never call each other directly or synchronously. Instead, they communicate through the **Bridge**: an asynchronous, batched messaging channel where every message — "create this view," "update this view's props," "a touch event just happened" — is serialized to JSON, queued, and passed across to the other side, where it's deserialized and acted on. This is deliberately batched (many messages sent together rather than one at a time) to reduce overhead, and it's asynchronous by design, meaning JS never blocks waiting for native to respond and vice versa. This worked well for a long time, but it has real, well-documented costs: JSON serialization/deserialization of every single cross-thread message is CPU work that scales badly with message frequency, and because the bridge is asynchronous, there's no way for JS to synchronously ask native "what is this view's current on-screen size right now" — it has to send a message and wait for a batched response on a future tick. This becomes a genuine performance bottleneck for high-frequency interactions — gesture-driven animations, drag-and-drop, anything that needs to react to touch movement at 60fps — where the batching/serialization latency shows up as visible lag or dropped frames.

The **New Architecture** (opt-in starting around React Native 0.68, and the default since 0.76/0.7x) was built specifically to remove the bridge as a bottleneck, replacing it with several coordinated pieces. **JSI (the JavaScript Interface)** is the foundational change: a lightweight C++ layer that lets JavaScript objects hold direct references to native C++ objects and invoke their methods *synchronously*, with no serialization and no message queue in between — see [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md) for a focused deep dive on this specific mechanism. **TurboModules** are the New Architecture's replacement for native modules: built on JSI, they're lazily loaded (a native module's implementation is only initialized the first time JS actually references it, rather than every native module eagerly loading at app startup) and can be called synchronously when needed, avoiding both the bridge's serialization cost and the old architecture's "load everything up front" startup overhead. **Fabric** is the new rendering system, replacing the old bridge-based UIManager: it also uses JSI to let the JS thread and native rendering layer share the same underlying C++ representation of the view tree, enabling synchronous layout reads/writes, better prioritization of urgent updates (like a text input keystroke) over less urgent ones, and tighter integration with React 18's concurrent rendering features. **Codegen** is the tooling that ties it together safely: it statically analyzes TypeScript/Flow type definitions for your native modules and native components and generates the corresponding native (C++/Objective-C/Java/Kotlin) interface code at build time, giving you compile-time type safety across the JS/native boundary instead of the old architecture's untyped, stringly-typed bridge messages.

Taken together, the New Architecture's motivations were: **synchronous access** where it genuinely matters (measuring a view, calling a native method and getting a result back immediately) without giving up async as the default elsewhere; **eliminating unnecessary serialization overhead** for the large fraction of native calls that don't need to cross a process-style boundary at all; **better type safety** via Codegen-generated interfaces instead of hand-written, easy-to-mismatch bridge glue; and **lazy-loaded native modules** so app startup time doesn't pay the cost of initializing native modules the app may never use in a given session. As of the 0.7x releases, the New Architecture is enabled by default for new projects, and most major community libraries (`react-native-reanimated`, `react-native-screens`, `@react-native-community/netinfo`, etc.) have shipped New Architecture support, though some older or less-maintained third-party native modules may still assume the old bridge exists.

## Examples

Nothing about writing React Native *application* code changes with the New Architecture — the difference is entirely in how native modules and components are implemented and how the runtime wires things together. Enabling it is a build-level configuration:

```json
// app.json (Expo) — New Architecture is the default in modern Expo SDKs
{
  "expo": {
    "newArchEnabled": true
  }
}
```

```
// android/gradle.properties (bare React Native)
newArchEnabled=true
```

A TurboModule spec is defined with a typed interface that Codegen consumes to generate native glue code, illustrating the type-safety improvement over the old untyped bridge:

```ts
// NativeDeviceInfo.ts — Codegen reads this to generate native interface code
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getBatteryLevel(): number; // can be called synchronously via JSI
  getDeviceName(): Promise<string>; // async calls remain fully supported too
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceInfo');
```

Fabric's synchronous layout access shows up indirectly through libraries like `react-native-reanimated`, which relies on JSI to read/write UI properties on the native thread without round-tripping through an async bridge, which is why gesture-driven animations became dramatically smoother under the New Architecture:

```jsx
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Pressable } from 'react-native';

function LikeButton() {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPressIn={() => (scale.value = withSpring(0.9))} onPressOut={() => (scale.value = withSpring(1))}>
      <Animated.View style={animatedStyle}>
        {/* Runs on the UI thread via JSI, not round-tripped through the async bridge */}
      </Animated.View>
    </Pressable>
  );
}
```

## Common Pitfalls / Gotchas

- Assuming "New Architecture" means a full rewrite of your app code — it's almost entirely a runtime/build-level change; the vast majority of application-level React components are unaffected.
- Blaming janky gesture animations on "React being slow" when the actual cause under the old architecture was bridge serialization latency for high-frequency touch events — a well-understood, architecture-level bottleneck, not a JS performance problem per se.
- Assuming every third-party native module already supports the New Architecture — some older or unmaintained libraries only ship old-architecture (bridge-based) native code and can break or silently fall back when the New Architecture is enabled.
- Confusing the Shadow thread (Yoga layout calculations) with the native/UI thread (actual drawing and touch handling) — they're distinct, and conflating them leads to misdiagnosing which thread a given performance problem actually lives on.
- Thinking TurboModules eliminate async entirely — most native module calls remain async by default (returning Promises); synchronous calls via JSI are an option used deliberately for cases that need an immediate result, not the default for everything.

## Interview Questions & Answers

**Q: What problem was the old bridge architecture designed to solve, and what problem did it create?**
A: It solved safe cross-thread communication between JS and native by never letting either side block on the other — everything is async, batched, and passed as serialized JSON messages, which is simple and crash-resistant. The problem it created is that every single cross-thread interaction pays a serialization/deserialization cost and has to wait for the next batched flush, which becomes a real bottleneck for high-frequency interactions like gesture-driven animations that need to feel synchronous to the user.

**Q: What is JSI, in one or two sentences, and what does it unlock?**
A: JSI (JavaScript Interface) is a C++ layer that lets JavaScript hold direct references to native C++ objects/functions and call them synchronously, without going through the bridge's serialization and message-queue machinery. It unlocks synchronous native calls, removes unnecessary serialization overhead, and is the foundation both TurboModules and Fabric are built on. See [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md).

**Q: What are TurboModules and how do they differ from old-architecture native modules?**
A: TurboModules are the New Architecture's native modules, built on JSI. Unlike old-architecture native modules, which are all eagerly instantiated at app startup regardless of whether they're used, TurboModules are lazily loaded — instantiated the first time JS actually references them — and they can be invoked synchronously when needed, in addition to the traditional async/Promise-based style.

**Q: What is Fabric, and what does it replace?**
A: Fabric is the New Architecture's rendering system, replacing the old bridge-based UIManager. It uses JSI so the JS thread and the native rendering layer can share the same underlying C++ representation of the view/layout tree, enabling synchronous layout access, better prioritization of urgent versus non-urgent updates, and tighter alignment with React 18's concurrent rendering model.

**Q: What role does Codegen play in the New Architecture?**
A: Codegen statically analyzes TypeScript/Flow type definitions for native modules and native components and generates the corresponding native-language (Objective-C/C++/Java/Kotlin) interface code at build time. This replaces the old architecture's untyped, hand-written bridge glue with a compile-time-checked contract between JS and native, catching type mismatches before runtime instead of failing silently or crashing in production.

## Related Topics
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [hermes-engine.md](./hermes-engine.md)
- [native-modules.md](./native-modules.md)
- [performance-optimization.md](./performance-optimization.md)
- [introduction-to-react-native.md](./introduction-to-react-native.md)
- [../React/virtual-dom-and-reconciliation.md](../React/virtual-dom-and-reconciliation.md)
