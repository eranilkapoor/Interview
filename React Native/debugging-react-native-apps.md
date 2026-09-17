# Debugging React Native Apps

Debugging a React Native app spans three overlapping layers: the JavaScript layer (your component logic, state, network calls), the native layer (crashes, native module errors, platform-specific issues), and the bridge/rendering layer connecting them (why a view isn't updating, why a native module call is failing silently). Because of this, React Native debugging tends to involve more tools than typical web development — no single inspector covers everything, and picking the right tool for the symptom you're seeing matters as much as knowing how to use each one individually.

For component-level issues — wrong props, unexpected state, an unnecessary re-render — **React DevTools** is the primary tool, and it works essentially the same way it does for web React: it shows the live component tree, lets you inspect and edit props/state/hooks on a selected component, and profile renders. Since React Native apps don't run in a browser, DevTools ships as a standalone app (`npx react-devtools`) that connects to your running app, though newer tooling increasingly surfaces an equivalent experience through the in-app developer menu. `../React/react-testing-basics.md` and the rest of the `React/` folder's hook/state material is exactly what you're reading through DevTools' panels — the tool is React Native-specific, but the concepts it's showing you (props, state, the component tree, why something re-rendered) are plain React.

**Flipper** was, for several years, the standard desktop debugging platform for React Native — a plugin-based app providing a network inspector, a layout inspector for the native view hierarchy, native log streaming, and a plugin ecosystem (Redux DevTools integration, AsyncStorage viewer, and more) all in one place. Its relevance has declined in newer React Native versions: it depended on a fairly heavy native integration that added build complexity, and much of what it offered is being subsumed by lighter-weight, built-in tooling — most notably the **React Native DevTools**, a debugger built directly into the React Native CLI (accessible via the in-app dev menu's "Open DevTools" or by pressing `j` in the Metro terminal) that provides Chrome-DevTools-style breakpoint debugging, console access, and a network inspector without a separate app. This shift runs in parallel with **Hermes** becoming the default JS engine: Hermes ships its own debugger protocol support, which is what the new built-in DevTools connects to, making the older "attach Chrome to a JSContext" remote-debugging approach (which had its own well-known pitfalls, like JS running in a different environment/timezone than the device during debugging) largely obsolete.

For in-app, on-device feedback, **LogBox** is what actually surfaces JS errors and warnings as an overlay directly on the running app — a red full-screen error box for uncaught exceptions and a yellow inline notice for warnings, both tappable for a full stack trace. It's the direct successor to the older "YellowBox"/"RedBox" system, unified into one component with better stack-trace symbolication and the ability to selectively ignore known warnings. Alongside LogBox, plain `console.log`/`console.warn`/`console.error` calls remain a debugging workhorse — they stream to the Metro bundler's terminal output by default, and also show up in the React Native DevTools console panel when connected, giving you a quick way to trace values without attaching a full debugger.

Finally, a category of bugs simply isn't visible from the JS side at all: native crashes, permission issues, native module linking problems, and platform-specific rendering glitches require looking at native logs directly — **Xcode**'s console/device logs for iOS (and its crash reports for native crashes), and **Android Studio**'s **Logcat** for Android. These surface things like a missing Info.plist permission entry, a native module that failed to initialize, or an ANR (Application Not Responding) on Android — none of which a JS-only debugger would ever show you, since by the time JS execution would report an error, the native layer has already failed.

## Examples

```jsx
// Deliberately triggering LogBox: an uncaught error becomes a full-screen
// red overlay in development, with tap-to-expand stack trace
function UserProfile({ user }) {
  // If `user` is ever undefined, this throws and LogBox shows it immediately
  // in dev builds, instead of a silent crash or blank screen.
  return <Text>{user.name.toUpperCase()}</Text>;
}
```

```jsx
// Selectively silencing a known, noisy warning via LogBox's ignore API
// (use sparingly — this hides real signal, not just noise)
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  'Sending `onAnimatedValueUpdate` with no listeners registered',
]);

// Or ignore everything (strongly discouraged outside of a very specific,
// documented reason — it hides all future warnings too):
// LogBox.ignoreAllLogs();
```

```jsx
// Structured console logging that's easy to grep for in the Metro terminal
// or the React Native DevTools console panel
function fetchUserProfile(userId) {
  console.log('[UserProfile] fetching', { userId });
  return api
    .get(`/users/${userId}`)
    .then((res) => {
      console.log('[UserProfile] success', { userId, status: res.status });
      return res.data;
    })
    .catch((err) => {
      console.error('[UserProfile] failed', { userId, message: err.message });
      throw err;
    });
}
```

## Common Pitfalls / Gotchas

- Assuming a blank/frozen screen with no JS error is a JS bug — it's frequently a native crash or a native module failing to link, which only shows up in Xcode/Logcat, not LogBox or the Metro terminal.
- Leaving verbose `console.log` calls in production code paths — logging has a real performance cost, especially inside render or tight loops, and can leak information you didn't intend to ship.
- Relying on the legacy Chrome remote-debugging workflow, which executes your JS in Chrome's V8 engine on the desktop rather than Hermes on the device — timing, `Intl` behavior, and available globals can all differ from what actually runs in production, leading to "works when debugging, breaks in the real app" bugs.
- Globally ignoring LogBox warnings (`LogBox.ignoreAllLogs()`) to reduce noise during development — this hides new, potentially serious warnings just as easily as the noisy one you meant to silence.
- Forgetting that Flipper (where still used) requires the native app to be a debug build with the Flipper native dependencies linked — it won't connect to a release build, and misconfigured native linking is a common source of "Flipper won't connect" issues.
- Debugging performance issues (jank, dropped frames) using only console logs — this class of problem needs a profiler (React DevTools Profiler, native GPU/CPU tooling, or a dedicated performance monitor), since logging itself adds overhead that can mask the real bottleneck.

## Interview Questions & Answers

**Q: What's the difference between debugging with React DevTools versus native tools like Xcode/Logcat?**
A: React DevTools operates purely at the JS/component layer — props, state, hooks, the component tree, render profiling. Xcode and Logcat operate at the native layer, surfacing native crashes, permission errors, native module linking failures, and platform logs that never reach JS at all. A blank screen or app crash with no JS error is a strong signal to check native logs, since the failure happened before or outside of JS execution.

**Q: What is LogBox, and how does it differ from a plain `console.error`?**
A: LogBox is React Native's in-app overlay that intercepts uncaught errors and warnings and renders them directly on the running app — a full-screen red overlay for errors, an inline yellow notice for warnings — with tap-to-expand stack traces, in development builds. It's the successor to the older YellowBox/RedBox system. A plain `console.error` call by itself just writes to the console/Metro terminal; LogBox is what turns certain errors into an unmissable on-device UI.

**Q: Why has Flipper's role diminished in newer React Native versions?**
A: Flipper required a fairly heavy native integration (native SDKs linked into the app) that added build complexity and could become a source of build/version-compatibility issues. Its major use cases — a network inspector, layout inspector, and debugger — are increasingly covered by lighter-weight tooling built directly into the React Native CLI, particularly the new React Native DevTools connecting to Hermes's built-in debugger protocol, reducing the need for a separate heavyweight app.

**Q: Why is remote JS debugging via Chrome considered outdated now?**
A: It worked by running your app's JS in Chrome's V8 engine on the desktop instead of the actual on-device engine (historically JavaScriptCore, now typically Hermes), forwarding messages back to the device. This meant you were debugging code executing in a different JS environment than production — different timing characteristics, different `Intl`/global behavior — which could hide or introduce bugs that only manifest in one environment. Hermes shipping its own debugger protocol, exposed through the built-in React Native DevTools, lets you debug the actual on-device engine directly instead.

**Q: You see a warning in the yellow LogBox overlay during development — should you always fix it before shipping?**
A: Not necessarily immediately, but it shouldn't be ignored either — warnings often flag real problems (a missing key in a list, a deprecated API, an unhandled promise rejection) that don't crash the app today but indicate fragile code or a future breaking change. The right move is to triage: fix what's addressable, and only suppress via `LogBox.ignoreLogs` with a specific message match (never a blanket ignore) for warnings that are confirmed noise, with a comment explaining why.

## Related Topics
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [hermes-engine.md](./hermes-engine.md)
- [testing-react-native-apps.md](./testing-react-native-apps.md)
- [native-modules.md](./native-modules.md)
- [../React/react-testing-basics.md](../React/react-testing-basics.md)
