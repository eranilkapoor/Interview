# Native Modules

A Native Module is how React Native code reaches out to platform APIs and SDKs that aren't already exposed by React Native core or an existing third-party library — think Bluetooth, biometric authentication beyond what's already wrapped, a proprietary payment SDK, a barcode scanner with vendor-specific hardware access, or any functionality that fundamentally requires calling into Swift/Objective-C on iOS or Kotlin/Java on Android. The vast majority of RN app code never needs to write one, because the ecosystem already wraps the common cases (camera, storage, networking, notifications), but understanding what a native module *is* and how JS talks to native code is core RN knowledge, since it explains what's actually happening underneath every third-party native library you `npm install`.

Conceptually, a native module exposes a set of native functions to JavaScript as a JS object with methods you can call like any other JS API — `SomeNativeModule.doSomething(args)` — while the actual implementation runs as compiled native code on each platform. Historically (RN's "legacy" architecture), this worked via "the bridge": JS and native code run on separate threads/runtimes with no shared memory, so calls between them are serialized to JSON, batched, and passed asynchronously across the bridge in both directions. `NativeModules` was the JS-side registry you imported to access modules exposed this way (`import { NativeModules } from 'react-native'`), and because native code can't just "return" a value across an async bridge, calls resolved through callbacks or, more commonly, Promises. For native-to-JS communication that isn't a direct response to a JS call — a native event firing spontaneously, like a Bluetooth device connecting — the bridge era used `NativeEventEmitter`, which lets a native module emit named events that JS subscribes to with `.addListener()`.

The modern approach, part of React Native's "New Architecture," replaces the JSON-serializing bridge with TurboModules built on JSI (the JavaScript Interface) — a lightweight C++ layer that lets JS hold direct references to native C++ objects and call their methods synchronously, in the same way it can call a JS function, without serializing everything to JSON and hopping across an async bridge. A TurboModule is defined with a strongly-typed spec file (TypeScript or Flow) describing its exact shape, which Codegen (RN's build-time code generation tool) reads to produce native interface code in each platform's language, ensuring the native implementation and the JS-side types can never silently drift out of sync the way loosely-typed bridge modules could. The practical payoff is that TurboModules can be called synchronously when needed (no round-trip delay for something like reading a cached value), are lazily loaded (a module isn't instantiated until JS actually references it, improving startup time versus the old architecture's eager module initialization), and give you compile-time type safety on the native side generated straight from the spec.

Writing a native module is genuinely native development, not just JS — you're writing real Swift/Objective-C and Kotlin/Java, registering the module with RN's native module registry on each platform, and handling threading concerns (bridge/legacy modules run their native methods on a background thread by default, unless explicitly marked to run on the main/UI thread), so it's a meaningfully bigger lift than reaching for a JS-only solution. Because of that cost, the practical first move whenever you think you need a native module is almost always to check whether an existing, well-maintained community package already wraps that native capability — writing a custom native module is for the genuine gap: an SDK, hardware feature, or platform API that nothing in the ecosystem exposes yet.

## Examples

```java
// Android (Kotlin), legacy bridge-style Native Module: exposes a simple
// synchronous-feeling async function returning the device's unique ID.
class DeviceInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "DeviceInfo"

  @ReactMethod
  fun getUniqueId(promise: Promise) {
    try {
      val id = Settings.Secure.getString(
        reactApplicationContext.contentResolver,
        Settings.Secure.ANDROID_ID
      )
      promise.resolve(id)
    } catch (e: Exception) {
      promise.reject("DEVICE_INFO_ERROR", e)
    }
  }
}
```

```jsx
// JS side, legacy bridge: calling the native module via NativeModules,
// and subscribing to a native event via NativeEventEmitter.
import { NativeModules, NativeEventEmitter } from 'react-native';

const { DeviceInfo, BluetoothManager } = NativeModules;

async function logDeviceId() {
  const id = await DeviceInfo.getUniqueId(); // resolves via the bridge's Promise plumbing
  console.log('Device ID:', id);
}

const bluetoothEmitter = new NativeEventEmitter(BluetoothManager);
const subscription = bluetoothEmitter.addListener('onDeviceConnected', (device) => {
  console.log('Connected to', device.name); // fired spontaneously from native code
});
// Always remove the subscription on cleanup (e.g., in a useEffect cleanup function)
// to avoid leaking listeners when the component unmounts.
subscription.remove();
```

```ts
// New Architecture: a TurboModule spec (TypeScript), read by Codegen to
// produce native interface code on both platforms.
// NativeDeviceInfo.ts
import type { TurboModule } from 'react-native/Libraries/TurboModule/RCTExport';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  getUniqueId(): string; // can be synchronous, JSI-backed — no bridge round trip
  getBatteryLevel(): Promise<number>; // async calls remain Promise-based
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceInfo');

// Usage from anywhere in the app — looks identical to any other JS import:
import DeviceInfo from './NativeDeviceInfo';
const id = DeviceInfo.getUniqueId(); // synchronous JSI call, no await needed
```

## Common Pitfalls / Gotchas

- Writing a custom native module for something a well-maintained community library already covers — always check the ecosystem first; native modules are a real maintenance burden (two native codebases, plus the JS glue) that's only worth taking on for a genuine capability gap.
- Forgetting to remove `NativeEventEmitter` listeners on unmount — spontaneous native events keep firing into JS for a component that no longer exists, which can throw errors or silently leak memory.
- Assuming legacy bridge calls are synchronous — every bridge call is inherently asynchronous (serialized, batched, and sent across threads), so even a native function that "returns instantly" from a native perspective still resolves as a Promise/callback in JS.
- Doing heavy work directly on a bridge module's method without dispatching to a background thread on the native side — depending on configuration, some native methods can block the thread they're invoked on, and a slow native call can visibly stall the JS thread or UI.
- Mixing legacy `NativeModules` patterns with New Architecture TurboModules inconsistently across a codebase mid-migration — a module registered only the old way won't be available through the TurboModule registry, and vice versa, leading to confusing "module not found" runtime errors.
- Not handling the platform difference in native module implementations symmetrically — it's easy to fully implement and test a module on iOS (or Android) and ship the other platform's implementation half-finished or throwing "not implemented," which only surfaces when QA or a user hits it on that platform.
- Letting native module method names or argument shapes drift from what Codegen expects in a TurboModule spec — Codegen generates native interface code directly from the spec, so a native implementation that doesn't match the generated interface fails to compile rather than failing at runtime, which is a feature but can be a confusing build error if you don't know to look at the generated spec.

## Interview Questions & Answers

**Q: Why would you write a custom Native Module instead of using something already available in JS?**
A: Because some functionality fundamentally requires calling into platform-native APIs or SDKs that JavaScript has no access to and that React Native core or the existing library ecosystem doesn't already expose — a proprietary hardware SDK, a platform capability like Bluetooth or biometrics beyond what's wrapped, or vendor-specific integrations. It's a deliberate escape hatch, not a default tool, precisely because it means maintaining real native (Swift/Objective-C and Kotlin/Java) code alongside your JS.

**Q: Explain how the legacy "bridge" architecture gets data from JS to native code and back.**
A: JS and native code run in separate environments with no shared memory, so the bridge serializes calls and their arguments to JSON, batches them, and sends them asynchronously across to the other side, where they're deserialized and dispatched. Because everything crosses this async boundary, even a native call that completes "instantly" resolves in JS via a callback or, more idiomatically, a Promise — there's no way to get a native value back synchronously through the bridge.

**Q: What problem do TurboModules and JSI solve that the old bridge didn't?**
A: The old bridge's JSON serialization and async batching add real overhead and mean every native call, even a cheap synchronous-feeling one, pays a round-trip cost and can never return a value directly. JSI lets JS hold direct references to native C++ objects and invoke their methods synchronously, in-process, without JSON serialization or crossing an async bridge — so TurboModules can expose genuinely synchronous native calls, and they're also lazily loaded (instantiated only when JS first references them) rather than all being initialized eagerly at startup, which improves app startup time.

**Q: What role does Codegen play in a TurboModule?**
A: Codegen reads a strongly-typed JS/TS spec file describing a TurboModule's exact interface and generates matching native interface code (Objective-C++/Kotlin) at build time. This keeps the native implementation and the JS-side type contract from silently drifting apart — a mismatch between what the spec declares and what the native code actually implements becomes a build-time error instead of a runtime surprise, which is a meaningful reliability improvement over the loosely-typed legacy bridge modules.

**Q: How do you handle a native module emitting events spontaneously, not in direct response to a JS call?**
A: Via an event-emitter pattern: on the legacy bridge, `NativeEventEmitter` wraps a native module that calls a native event-emitting API, and JS subscribes with `.addListener('eventName', handler)`, remembering to call `.remove()` on that subscription when the consuming component unmounts to avoid leaking listeners or handling events for a dead component. The New Architecture has its own analogous event-emitter support for TurboModules, following the same subscribe/unsubscribe discipline.

## Related Topics
- [react-native-architecture.md](./react-native-architecture.md)
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [native-ui-components.md](./native-ui-components.md)
- [hermes-engine.md](./hermes-engine.md)
- [platform-specific-code.md](./platform-specific-code.md)
- [../React/custom-hooks.md](../React/custom-hooks.md)
