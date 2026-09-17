# React Native Interview Preparation

This folder is a complete, interview-focused reference for React Native: how it works under the hood (bridge/JSI, Hermes, the old and new architectures), how to build real mobile UI with it (layout, lists, gestures, animation, accessibility), and the practical concerns that separate "knows React" from "has shipped a React Native app" — navigation, persistence, networking, permissions, native device integration, performance, testing, security, and getting a build into the App Store or Play Store. Each topic file follows the same structure: a short conceptual explanation, 2-3 real, runnable code examples, a list of common pitfalls/gotchas, 3-5 interview Q&A pairs, and links to related topics. Where a concept is really plain React (hooks, context, component lifecycle) rather than something RN-specific, the topic file links out to [`../React/`](../React/README.md) instead of repeating it.

## Table of Contents

### Fundamentals & Architecture
- [Introduction to React Native](./introduction-to-react-native.md)
- [React Native Architecture (Old vs New)](./react-native-architecture.md)
- [The JavaScript Bridge vs JSI](./javascript-bridge-and-jsi.md)
- [Hermes Engine](./hermes-engine.md)
- [Expo Managed Workflow vs Bare React Native](./expo-vs-bare-workflow.md)
- [Native Modules](./native-modules.md)
- [Native UI Components](./native-ui-components.md)
- [Platform-Specific Code](./platform-specific-code.md)

### UI, Layout & Styling
- [Core Components](./core-components.md)
- [Flexbox Layout in React Native](./flexbox-layout-in-react-native.md)
- [Styling in React Native](./styling-in-react-native.md)
- [Responsive Design and Screen Sizes](./responsive-design-and-screen-sizes.md)
- [FlatList vs ScrollView vs SectionList](./flatlist-vs-scrollview-vs-sectionlist.md)
- [Animations](./animations.md)
- [Gesture Handling](./gesture-handling.md)
- [Accessibility](./accessibility.md)

### State Management & Data
- [State Management in React Native](./state-management.md)
- [Async Storage](./async-storage.md)
- [Networking and API Calls](./networking-and-api-calls.md)
- [Forms and Validation](./forms-and-validation.md)
- [Common Custom Hooks and Patterns](./common-custom-hooks-and-patterns.md)

### Navigation, Device Integration & Security
- [Navigation](./navigation.md)
- [Deep Linking](./deep-linking.md)
- [App State and Lifecycle](./app-state-and-lifecycle.md)
- [App Permissions](./app-permissions.md)
- [Push Notifications](./push-notifications.md)
- [Image and Media Handling](./image-and-media-handling.md)
- [Security in React Native](./security-in-react-native.md)

### Performance, Testing & Debugging
- [Performance Optimization in React Native](./performance-optimization-in-react-native.md)
- [Debugging React Native Apps](./debugging-react-native-apps.md)
- [Testing React Native Apps](./testing-react-native-apps.md)

### Build & Deployment
- [Building and Release](./building-and-release.md)
- [Over-the-Air (OTA) Updates](./over-the-air-updates.md)

## Interview Questions & Answers — Curated

These are cross-cutting questions that pull from multiple topics in this folder — the kind an interviewer asks to see whether your knowledge connects, not just whether you can recite one file's contents.

**Q: What actually happens when a React Native app starts up, from process launch to the first screen on the display? *(Intermediate)***
A: The native side boots first — on iOS an `AppDelegate`/`UIApplication` launches and on Android an `Activity` starts — and that native shell creates a JS runtime (Hermes, ahead-of-time compiled to bytecode in production) and loads the JS bundle into it. The JS side runs `AppRegistry.registerComponent`, React renders the component tree, and the resulting UI description crosses into native: in the old architecture, serialized JSON batches over the asynchronous bridge to native view managers; in the new architecture (Fabric), synchronous JSI calls that construct native views more directly without the serialization step. Either way, the end result is real native views (`UIView`/`android.view.View`), not a WebView — see [react-native-architecture.md](./react-native-architecture.md) and [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md).

**Q: Why can't you just use CSS or the DOM in React Native? *(Beginner)***
A: There is no DOM and no browser rendering engine underneath React Native — JS never touches HTML or CSS. Instead, RN's `StyleSheet` API accepts a constrained, camelCased subset of CSS-like properties that get translated into native layout and paint instructions via Yoga (RN's Flexbox engine), and components like `View`/`Text`/`Image` map to real native view classes, not HTML tags. That's why there's no `<div>`, why text must be wrapped in `<Text>`, and why layout is Flexbox-only with no floats or CSS Grid — see [core-components.md](./core-components.md) and [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md).

**Q: `useState` vs Context vs Redux vs Zustand — how do you decide which to reach for in an RN app? *(Intermediate)***
A: Local `useState`/`useReducer` for state one component (and maybe its direct children) owns; Context for state that's genuinely global but changes rarely (theme, auth session) since every consumer re-renders on any change; Redux when the app is large, shares logic with a web codebase, or needs the DevTools/middleware ecosystem, accepting its boilerplate; Zustand/Jotai when you want selector-based subscriptions (only the components that read a specific slice re-render) without Redux's ceremony — which matters more on mobile because a dropped frame during a `FlatList` scroll is immediately visible to the user. See [state-management.md](./state-management.md).

**Q: How do you persist data across app restarts in React Native, and what are the tradeoffs between the options? *(Intermediate)***
A: `AsyncStorage` is the baseline key-value store — simple, asynchronous, unencrypted by default, and noticeably slower for frequent reads/writes. `MMKV` is a synchronous, JSI-backed alternative that's much faster and supports encryption, at the cost of an extra native dependency. For sensitive data (tokens, credentials), neither is appropriate on its own — use `react-native-keychain` (iOS Keychain / Android Keystore) instead. Whichever store you pick, rehydrating persisted state on cold launch is asynchronous, so the UI needs an explicit loading gate to avoid a flash of default/empty state. See [async-storage.md](./async-storage.md) and [security-in-react-native.md](./security-in-react-native.md).

**Q: Why is `FlatList` preferred over `ScrollView` for long lists, and what makes a `FlatList` perform badly? *(Intermediate)***
A: `ScrollView` renders every child immediately regardless of visibility, so a long list means mounting hundreds of off-screen native views up front — slow initial render and high memory use. `FlatList` virtualizes: it only renders items near the viewport and recycles views as the user scrolls. It performs badly when `renderItem` isn't memoized, when `keyExtractor` is missing or unstable (causing full re-renders/remounts instead of reordering), when inline arrow functions/objects are passed as props (breaking `React.memo` on row components), or when `getItemLayout` isn't provided for fixed-height rows (forcing RN to measure dynamically). See [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md) and [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md).

**Q: What's the difference between the old React Native architecture (bridge) and the new architecture (JSI/Fabric/TurboModules)? *(Advanced)***
A: The old architecture communicates between JS and native exclusively through an asynchronous bridge that serializes every call to JSON, batches it, and passes it across — which is safe but adds latency and makes truly synchronous native calls impossible. The new architecture replaces this with JSI (JavaScript Interface), which lets JS hold direct references to native C++ objects and call native methods synchronously without serialization; Fabric is the new renderer built on JSI for synchronous, more efficient UI updates, and TurboModules is the JSI-based replacement for native modules that lazily loads modules instead of initializing all of them at startup. See [react-native-architecture.md](./react-native-architecture.md) and [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md).

**Q: How does navigation state survive (or not survive) an app being killed by the OS, and why does that matter? *(Advanced)***
A: Mobile OSes routinely kill backgrounded apps to reclaim memory, then relaunch them cold when the user returns — unlike a web tab, which usually just stays alive or reloads to a fresh URL. React Navigation supports persisting and restoring navigation state across this kind of restart, but you have to opt in explicitly (persisting the nav state to storage and restoring it before the navigator mounts); get it wrong and users get dropped back to the root screen after a background kill, which feels broken even though nothing actually crashed. This connects directly to [app-state-and-lifecycle.md](./app-state-and-lifecycle.md) — `AppState` transitions are what let you detect background/foreground changes in the first place — and [navigation.md](./navigation.md).

**Q: Why does a missing `Info.plist` usage-description string crash an iOS app, while the equivalent Android mistake just silently fails to prompt? *(Advanced)***
A: iOS treats calling a permission-triggering API without a declared usage-description key (e.g., `NSCameraUsageDescription`) as a programming error and throws an uncaught native exception that terminates the app immediately. Android's manifest declarations work differently — a missing `<uses-permission>` entry just means `PermissionsAndroid`/`react-native-permissions` never surfaces a system dialog at all, failing quietly instead of crashing. Both are platform configuration steps that have to happen before any JS-side `check`/`request` call can succeed, but the failure modes are opposite in visibility. See [app-permissions.md](./app-permissions.md).

**Q: What's the mobile-specific reason deep linking is harder to get right than a web route? *(Advanced)***
A: A web URL always lands in a browser with predictable state; a deep link into a mobile app can arrive while the app is fully closed (cold start — the app must boot, then navigate to the target screen once ready), backgrounded (warm start — the OS just resumes the app and fires a URL event), or already open on that exact screen. Each case needs different handling, and a universal/app link additionally requires host-side verification files (`apple-app-site-association`, Android's `assetlinks.json`) so the OS trusts the app enough to intercept the URL instead of opening a browser. See [deep-linking.md](./deep-linking.md).

**Q: Why is over-the-air (OTA) updating (e.g., CodePush, EAS Update) not a full substitute for an app store release? *(Advanced)***
A: OTA updates can only ship changes to the JS bundle and other JS-loadable assets — they cannot ship new native code, new native dependencies, or changes to native permissions/entitlements, because those require the compiled native binary the store distributed. Apple's and Google's store policies also restrict what OTA updates may do (no altering core app functionality outside what the reviewed binary does). This is why teams keep a native release pipeline for anything touching native modules and reserve OTA for JS bug fixes and content/config changes. See [over-the-air-updates.md](./over-the-air-updates.md) and [building-and-release.md](./building-and-release.md).

**Q: Where should you store an auth token in a React Native app, and why not just use `AsyncStorage`? *(Intermediate)***
A: `AsyncStorage` is unencrypted by default and readable by anything with access to the device's storage on a rooted/jailbroken device — fine for non-sensitive cache data, not for credentials. Auth tokens belong in the platform's secure storage (iOS Keychain, Android Keystore), typically accessed via `react-native-keychain`, which encrypts values at rest using OS-level facilities. See [security-in-react-native.md](./security-in-react-native.md).

**Q: How do you debug a React Native app that behaves differently on-device than in the simulator? *(Intermediate)***
A: Simulators/emulators don't reproduce real network conditions, thermal throttling, background app suspension, low-memory kills, or real GPS/sensor input, so bugs tied to any of those only show up on-device. Practically: use Flipper or the React Native DevTools for on-device inspection, `console.log`/remote debugging via Hermes's debugger protocol, and for release-mode-only bugs (which behave differently from dev mode due to minification and different bundling), attach a release build to native debugging tools (Xcode Instruments, Android Studio profiler) since JS remote debugging isn't available in release builds. See [debugging-react-native-apps.md](./debugging-react-native-apps.md).

**Q: What's the difference between testing strategies for RN components vs testing plain React web components? *(Intermediate)***
A: The fundamentals (Jest, React Testing Library's render/query/fireEvent API) carry over directly since it's the same React underneath. What's RN-specific: native modules and platform APIs (camera, permissions, `AsyncStorage`, `NetInfo`) need to be mocked since they don't exist in a Node test environment; `react-native-testing-library` (the RN-flavored RTL) queries by accessibility roles/labels and text the same way, but gesture and animation-driven interactions often need additional mocking (`react-native-reanimated`'s Jest mock, for example); and end-to-end testing needs a device/simulator-driving tool like Detox rather than a browser automation tool like Playwright/Cypress. See [testing-react-native-apps.md](./testing-react-native-apps.md).

**Q: Why does React Native performance work so often come down to reducing re-renders and avoiding the JS thread doing too much at once? *(Advanced)***
A: RN runs JS on a single JS thread separate from the native UI thread; gestures, animations, and list scrolling need to hit ~60fps (a new frame every ~16ms) on the native side, but any JS-driven layout/state update that's slow blocks the JS thread and can indirectly cause dropped frames or laggy interaction handling. That's why the standard toolkit — `React.memo`, stable `useCallback`/`useMemo` references, `FlatList` virtualization tuning, moving animations to the native/UI thread via `react-native-reanimated`'s worklets instead of driving them from JS-thread state updates — all converge on the same goal: do less work on the JS thread, and don't let unnecessary re-renders compound it. See [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md) and [animations.md](./animations.md).

**Q: What makes accessibility in React Native different from accessibility on the web? *(Intermediate)***
A: There's no semantic HTML (`<button>`, `<nav>`, `<h1>`) to lean on for free accessibility — every RN component needs explicit `accessible`, `accessibilityRole`, `accessibilityLabel`, and sometimes `accessibilityState`/`accessibilityValue` props to be understood correctly by VoiceOver (iOS) or TalkBack (Android), which are the mobile equivalents of a screen reader but with different gesture models and APIs than web screen readers. A custom `Pressable`-based button, for instance, conveys none of its role or state to assistive tech unless you set it explicitly, unlike a native HTML `<button>` which is accessible by default. See [accessibility.md](./accessibility.md).

**Q: How would you architect image and media handling for a feed-style screen with many images, and what goes wrong if you don't? *(Advanced)***
A: Use a virtualized list (`FlatList`, not `ScrollView`) so off-screen images aren't even mounted, set explicit `width`/`height` on remote images (`{ uri }`) since RN can't infer their intrinsic size, use a caching image library (e.g., `react-native-fast-image` or Expo's `Image`) instead of the bare `Image` component to avoid redundant network fetches and get better memory management, and choose an appropriate `resizeMode`. Skipping these causes classic symptoms: layout collapsing to zero size on remote images without explicit dimensions, memory pressure/crashes from loading full-resolution images into a small thumbnail slot, and re-fetching the same image repeatedly during scroll. See [image-and-media-handling.md](./image-and-media-handling.md) and [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md).

**Q: Why would a team choose Expo's managed workflow over bare React Native, or vice versa? *(Beginner)***
A: Expo's managed workflow trades some native flexibility for a much faster setup (no Xcode/Android Studio project to hand-configure), OTA updates via EAS Update, and a large library of pre-integrated native modules (camera, notifications, etc.) that just work without manual native linking. Bare React Native (or Expo's "bare workflow," which still uses Expo tooling but exposes the native projects) is the right call when the app needs a native module Expo doesn't support, custom native code, or fine-grained control over native build configuration that the managed workflow abstracts away. See [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md).

**Q: What's a native module, and when do you actually need to write one? *(Advanced)***
A: A native module is hand-written Swift/Objective-C (iOS) or Kotlin/Java (Android) code exposed to JS, needed when a capability genuinely isn't available through any existing JS/RN API or community library — direct access to a native SDK, a performance-critical operation better done in native code, or integrating an existing native library that has no RN wrapper. Before writing one, the practical interview answer is to check whether a maintained community package already wraps it, since native modules mean maintaining separate iOS and Android implementations and losing some of RN's "write once" benefit. See [native-modules.md](./native-modules.md).

**Q: How do you handle platform differences (iOS vs Android) in a shared RN codebase without duplicating whole components? *(Beginner)***
A: RN provides file-based platform splitting (`Component.ios.js` / `Component.android.js`, resolved automatically at bundle time by filename) for larger divergence, and the `Platform.OS`/`Platform.select({ ios: ..., android: ... })` API for small inline differences (a style tweak, a different constant) within the same file. The choice is about how much actually differs: a handful of style properties belongs in `Platform.select`, while a component whose structure and behavior meaningfully diverge between platforms is clearer as separate `.ios`/`.android` files. See [platform-specific-code.md](./platform-specific-code.md).

## How to Use This Folder

This folder assumes you already know core React — components, props, hooks (`useState`, `useEffect`, `useContext`, `useReducer`, `useCallback`/`useMemo`), the component lifecycle, controlled vs. uncontrolled inputs, and the Context API vs. external state libraries. If any of that is shaky, start in [`../React/`](../React/README.md) first — this folder deliberately doesn't re-explain that material, and every topic file here that touches it links back out to the relevant `../React/` file instead of repeating it.

Once the React fundamentals are solid, a reasonable path through this folder is: **Fundamentals & Architecture** (understand what RN actually is and how JS talks to native) → **UI, Layout & Styling** (build real screens) → **State Management & Data** and **Navigation, Device Integration & Security** (make screens talk to each other and to the outside world) → **Performance, Testing & Debugging** and **Build & Deployment** (ship it and keep it working). For interview prep specifically, read one topic at a time, work through its code examples by typing them out rather than just reading them, answer its Q&A section out loud without looking, and then connect it back to a real project you've built — interviewers consistently probe for that connection more than for memorized definitions.
