# The JavaScript Bridge vs JSI

The original React Native "Bridge" is, conceptually, a message-passing system connecting two completely separate, sandboxed runtimes: the JavaScript engine (running your app's JS on its own thread) and the native side (Objective-C/Swift on iOS, Java/Kotlin on Android, each with its own main/UI thread). Neither side can directly call functions or access objects living in the other's memory space — JS objects are JS objects, native objects are native objects, and there's no shared address space between them. So whenever JS needs native to do something (render a view, read a device sensor, show an alert) or native needs to tell JS something happened (a touch, a timer fired, a native module finished work), that information has to be packaged up, handed across, and unpacked on the other side. The Bridge is the mechanism that does this packaging: every call is serialized into a plain JSON-compatible message, pushed onto a queue, and the queue is flushed in batches — not necessarily every single message individually, but grouped together to amortize the cost of crossing the thread boundary — after which the receiving side deserializes each message and dispatches it to the right handler.

This design is fundamentally **asynchronous**: when JS calls a native method through the bridge, it cannot get a return value back synchronously in the same tick — the call is queued, eventually flushed to native, native does its work, and *if* a result is needed, native queues its own message back across the bridge to JS, which JS receives and handles (typically by resolving a Promise or invoking a callback) on some later tick of the JS event loop. This is workable and was the sole mechanism React Native used for its first several years, but it has two concrete costs that matter for performance-sensitive code: **serialization overhead** — every argument, every prop update, every event payload gets converted to and from JSON text (or a JSON-like intermediate format) on both ends, which is real CPU work that scales with message volume — and **batching latency** — because messages are queued and flushed rather than delivered instantly, there's an inherent delay between "JS decided to do something" and "native actually did it," which is invisible for occasional calls (like a network request finishing) but very visible for continuous, high-frequency interactions like a finger dragging across the screen, where every intermediate position update pays this same round-trip cost.

**JSI (the JavaScript Interface)** replaces that entire mental model. Rather than being a message queue, JSI is a thin C++ API baked directly into the JavaScript engine's runtime (Hermes, JSC, or V8 can all implement it) that lets a JavaScript value — specifically, a JS object — hold a direct reference to a C++ "host object" living on the native side, and lets JS call methods on that host object as if it were an ordinary JS function call. Under the hood, there's no JSON serialization step and no queue: the JS engine, via JSI, directly invokes the corresponding C++ function, synchronously, in the same call stack, and can get a real return value back immediately if needed. This is only possible because JSI operates at the C++ runtime level rather than treating JS and native as two black boxes that can only talk through a wire protocol — it exposes just enough of the JS engine's internals (creating JS objects, calling JS functions, converting between JS and C++ value representations) that native code can participate directly in the JS object graph.

This is precisely the mechanism that underpins both TurboModules and Fabric, described at a higher level in [react-native-architecture.md](./react-native-architecture.md): a TurboModule is, at its core, a C++ host object exposed to JS via JSI, so calling a TurboModule method can be as cheap as an ordinary function call (synchronous, when the module author chooses) instead of a full bridge round-trip; Fabric similarly uses JSI-backed host objects to let JS and the native rendering layer share access to the same underlying view-tree data structures. It's worth being precise that JSI doesn't mean *everything* becomes synchronous by default — most TurboModule methods are still exposed as Promise-returning async APIs where that's the right shape (a network call shouldn't block the JS thread regardless of how cheap the call mechanism is) — JSI just removes the serialization/queueing tax and makes synchronous calls *possible* where that's genuinely the right tool, which the old bridge architecturally could not offer at all.

## Examples

Conceptually, the old bridge's flow for a native module call looks like this (illustrative, not literal API):

```js
// Old architecture: every call is queued, serialized, and inherently async
NativeModules.Vibration.vibrate(500);
// Under the hood, roughly:
// 1. { module: 'Vibration', method: 'vibrate', args: [500] } is JSON-serialized
// 2. Pushed onto the outgoing message queue
// 3. Queue is flushed (batched with other pending calls) across to native
// 4. Native deserializes the message and calls the real native vibrate() method
// There is no way to get a synchronous return value from this call.
```

A JSI-backed TurboModule call, by contrast, behaves like a direct function call — no serialization, no queue, and a real synchronous return value is possible:

```ts
// New architecture: JS holds a direct reference to a native C++ host object via JSI
import DeviceInfo from './NativeDeviceInfo'; // Codegen-generated TurboModule spec

const level = DeviceInfo.getBatteryLevel(); // synchronous, direct call through JSI — no queue, no JSON
console.log(level); // real value, available immediately in this same tick
```

Libraries built directly on JSI (rather than the classic `NativeModules`/bridge API) expose this synchronous capability explicitly — `react-native-mmkv`, a fast key-value storage library, is a good real-world example of why this matters:

```js
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

// Synchronous reads/writes via JSI — no bridge round-trip, no async/await needed,
// which is only viable at all because JSI allows a direct, blocking native call.
storage.set('user.theme', 'dark');
const theme = storage.getString('user.theme');
```

## Common Pitfalls / Gotchas

- Describing JSI as "a faster bridge" — it's a categorically different mechanism (direct C++ object references and synchronous calls), not a faster version of the same async message-queue design.
- Assuming JSI makes all native calls synchronous — most still return Promises by design; JSI makes synchronous calls *possible* where a module author deliberately chooses that shape, not the default for every API.
- Forgetting that JSI is a native-engine-level capability, not something app code interacts with directly in most day-to-day React Native development — most developers benefit from JSI indirectly, through TurboModules/Fabric or JSI-based libraries, rather than writing raw JSI bindings themselves.
- Overusing synchronous native calls for anything slow — a synchronous JSI call still blocks the calling thread until it returns, so a slow synchronous native method (e.g., heavy disk I/O) can freeze the JS thread just as badly as a slow synchronous function anywhere else.
- Assuming old-architecture native modules automatically become JSI-based just because the New Architecture is enabled — modules need to be written (or updated) as TurboModules to actually get JSI's benefits; a legacy native module may still go through a compatibility shim.

## Interview Questions & Answers

**Q: Why couldn't the old bridge return values synchronously from native to JS?**
A: Because the bridge is fundamentally a queued, batched, asynchronous messaging system between two separate runtimes with no shared memory — a call is serialized, queued, and flushed across on its own schedule, and any response has to make the same trip back in the other direction. There's no mechanism in that design for JS to block and wait for an immediate answer; it's an inherently async, message-passing architecture, not a function-call architecture.

**Q: What specifically does JSI let native code do that the bridge couldn't?**
A: JSI lets native C++ code expose "host objects" that a JS engine can hold direct references to and invoke methods on synchronously, in the same call stack, with real return values — because JSI operates at the level of the JS engine's own C++ runtime API rather than treating native and JS as opaque endpoints of a message queue. This removes serialization overhead entirely and makes synchronous native calls possible where they weren't before.

**Q: Is JSI tied to a specific JavaScript engine like Hermes?**
A: No — JSI is an abstract C++ interface that any compliant JS engine can implement; Hermes, JavaScriptCore (JSC), and V8 have all had JSI implementations. It's the engine-agnostic layer that TurboModules and Fabric are built against, which is part of why React Native can swap JS engines (e.g., defaulting to Hermes) without TurboModules/Fabric needing engine-specific code.

**Q: Does JSI mean every native call in the New Architecture is now synchronous and blocking?**
A: No. JSI makes synchronous calls *possible*, but most TurboModule APIs remain Promise-based/async by design, especially for anything that does real work (network, disk, sensors) where blocking the JS thread would be harmful regardless of how cheap the call mechanism itself is. Synchronous JSI calls are used deliberately for cheap, fast operations where getting an immediate value genuinely matters, like reading a cached value or a UI measurement.

**Q: How does JSI relate to TurboModules and Fabric?**
A: JSI is the low-level foundation both are built on. A TurboModule is essentially a JSI host object exposing native module methods to JS without bridge serialization, supporting lazy loading and optional synchronous calls. Fabric uses JSI similarly so the JS thread and native rendering layer can share access to the same view-tree data structures directly, instead of going through the old bridge-based UIManager's async messaging.

## Related Topics
- [react-native-architecture.md](./react-native-architecture.md)
- [hermes-engine.md](./hermes-engine.md)
- [native-modules.md](./native-modules.md)
- [performance-optimization.md](./performance-optimization.md)
- [introduction-to-react-native.md](./introduction-to-react-native.md)
