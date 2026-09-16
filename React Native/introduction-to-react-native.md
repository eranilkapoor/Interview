# Introduction to React Native

React Native is a framework, originally created by Meta (then Facebook) and open-sourced in 2015, for building native mobile applications for iOS and Android using JavaScript and React. The crucial word there is *native*: unlike a hybrid approach that renders your UI inside a WebView (Cordova/PhoneGap being the classic example), React Native ultimately renders real, platform-native UI components — a `<Text>` in your JSX becomes a genuine `UILabel` on iOS or a `TextView` on Android, not an HTML `<span>` styled to look like one. You write your component tree, styling, and logic in JavaScript/JSX using the same component model, state, props, and hooks as web React, but the actual pixels on screen are drawn by the platform's own native rendering system, giving apps native look, feel, accessibility behavior, and performance characteristics that a WebView-based app struggles to match.

Because there's no DOM, React Native doesn't use HTML elements or CSS in the literal web sense. Instead of `<div>` and `<span>`, you compose apps from React Native's own built-in native components — `View`, `Text`, `Image`, `ScrollView`, `TextInput`, and so on — each of which maps to a real native view on each platform. Styling uses a JavaScript object syntax deliberately reminiscent of CSS (`StyleSheet.create({...})`, `flexDirection`, `padding`, `backgroundColor`) but it's a constrained subset implemented by React Native itself, not a browser's CSS engine — there's no cascade, no `:hover`, no CSS grid, and layout defaults to Flexbox with `flexDirection: 'column'` (the opposite of the web's `row` default). Everything else that makes React "React" — JSX, one-way data flow, props, `useState`/`useEffect`/`useReducer`/`useContext`, the reconciler's diffing algorithm — is unchanged; if you already know React, you already know most of React Native's programming model. See [../React/introduction-to-react.md](../React/introduction-to-react.md), [../React/jsx.md](../React/jsx.md), and [../React/components.md](../React/components.md) for that shared foundation, which this folder deliberately doesn't re-explain.

React Native's guiding philosophy is often summarized as "learn once, write anywhere," in deliberate contrast to "write once, run anywhere," the older promise of tools like Cordova/PhoneGap that tried to hide platform differences behind a single WebView-based abstraction. React Native takes the opposite stance: it doesn't pretend iOS and Android are the same platform. You reuse the same language, component model, and much of your business logic across platforms, but you're expected to write platform-specific UI or behavior where the platforms genuinely differ — different navigation conventions, different permission dialogs, different design languages (Human Interface Guidelines vs Material Design). React Native gives you tools for this (the `Platform` module, `.ios.js`/`.android.js` file extensions) rather than papering over it, which tends to produce apps that feel more authentically native than fully "write once" frameworks, at the cost of sometimes needing platform-aware code.

React Native has matured into one of the most widely used cross-platform mobile frameworks: Meta uses it in large parts of Facebook, Instagram, and the Messenger apps, and it's been adopted by companies like Shopify, Discord, Coinbase, and Microsoft (Xbox, Office apps) for production apps used by hundreds of millions of people. Its ecosystem has also evolved significantly since 2015 — most notably with a "New Architecture" (Fabric, TurboModules, JSI) that replaced the original asynchronous bridge with a more direct, synchronous communication layer between JavaScript and native code, covered in depth in [react-native-architecture.md](./react-native-architecture.md) and [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md).

A related, high-level piece worth knowing where it fits: Expo is a set of tools, services, and libraries built on top of React Native that dramatically simplifies project setup, native builds, and OTA updates — you can go from zero to a running app on a physical device in minutes without touching Xcode or Android Studio. Expo isn't a competitor to React Native; it's a layer on top of it (React Native itself powers Expo apps under the hood). The tradeoffs between Expo's managed tooling and a "bare" React Native project (where you own the native iOS/Android folders directly) are covered in [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md).

## Examples

A minimal React Native component looks structurally identical to a web React component, but is built from native primitives instead of HTML elements:

```jsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

function GreetingCard() {
  const [name, setName] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What's your name?</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Type here..."
      />
      <Pressable style={styles.button} onPress={() => alert(`Hello, ${name || 'stranger'}!`)}>
        <Text style={styles.buttonText}>Say hello</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 },
  button: { backgroundColor: '#1e90ff', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
});

export default GreetingCard;
```

Platform differences are handled explicitly rather than hidden, embracing "learn once, write anywhere":

```jsx
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  header: {
    paddingTop: Platform.OS === 'ios' ? 44 : 24, // account for notch vs status bar differently
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 }, // Android uses elevation, not CSS-style shadows
    }),
  },
});
```

Hooks and state work exactly as in web React — the same `useState`/`useEffect` mental model applies, just synchronizing with native APIs instead of the DOM:

```jsx
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

function ConnectivityBanner() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
    });
    return unsubscribe; // cleanup, same pattern as web useEffect
  }, []);

  if (isConnected) return null;
  return (
    <View style={{ backgroundColor: '#c0392b', padding: 8 }}>
      <Text style={{ color: 'white', textAlign: 'center' }}>No internet connection</Text>
    </View>
  );
}
```

## Common Pitfalls / Gotchas

- Assuming React Native apps run "in a browser" or WebView — they don't; there's no DOM, no `window`/`document` objects available by default, and no CSS cascade, which trips up developers porting web code directly.
- Reaching for HTML tags or web-only CSS properties (`<div>`, `display: grid`, `:hover`) — React Native has its own component and style vocabulary that only overlaps with CSS in naming, not implementation.
- Forgetting that Flexbox defaults to `flexDirection: 'column'` in React Native, the opposite of the web's `row` default, which silently breaks layouts copy-pasted from web CSS.
- Treating "cross-platform" as "identical on every platform" — genuinely different UX conventions (back gestures, permission prompts, safe areas, navigation patterns) often need explicit `Platform.OS` branching rather than a single shared implementation.
- Confusing React Native with Expo, or assuming you must choose one over the other permanently — Expo is tooling built on top of React Native, and modern Expo projects can still include custom native code via config plugins/prebuild.

## Interview Questions & Answers

**Q: How does React Native differ from a WebView-based hybrid framework like Cordova/PhoneGap?**
A: A hybrid/WebView framework renders your entire UI as HTML/CSS inside an embedded browser view, so what looks native is really a styled web page running inside a native shell. React Native instead renders actual native UI components — `View` becomes a real `UIView`/`ViewGroup`, `Text` becomes a real `UILabel`/`TextView` — so the app gets genuine native rendering, native input handling, and native performance characteristics, not an approximation of them inside a browser engine.

**Q: What does "learn once, write anywhere" mean, and how does it differ from "write once, run anywhere"?**
A: "Write once, run anywhere" implies a single codebase produces an identical experience everywhere, typically by abstracting away platform differences. "Learn once, write anywhere" is React Native's philosophy: you learn one programming model (React, JSX, components, hooks) and apply it across platforms, but you're expected to write platform-aware code where iOS and Android genuinely differ, using tools like the `Platform` API and platform-specific file extensions rather than having those differences hidden from you.

**Q: If there's no DOM, what are you actually rendering in a React Native app?**
A: You're rendering a tree of React Native's built-in native components (`View`, `Text`, `Image`, `ScrollView`, etc.), each of which is backed by a real native view class on the host platform. React's reconciler computes the same kind of virtual-tree diff it uses on the web, but instead of applying the resulting changes to DOM nodes, React Native applies them to native view instances through its rendering layer (historically the bridge, now Fabric — see [react-native-architecture.md](./react-native-architecture.md)).

**Q: Where does Expo fit relative to React Native?**
A: Expo is a set of tools, libraries, and cloud services built on top of React Native, not a separate framework or a competitor to it — an Expo app is a React Native app under the hood. It provides a much faster path to a running app (no need to set up Xcode/Android Studio initially), a large library of pre-integrated native modules, and services like EAS Build and OTA updates. See [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md) for the tradeoffs against a bare React Native project.

**Q: Name a few real companies using React Native in production and why that matters for the framework's credibility.**
A: Instagram, large parts of the Facebook and Messenger apps, Shopify, Discord, Coinbase, and Microsoft's Xbox and Office apps all ship React Native in production at significant scale. It matters because it demonstrates the framework holds up under real-world performance, reliability, and team-scaling demands — not just for small or prototype apps — and it's part of why Meta continues to invest heavily in the framework, including the New Architecture rewrite.

## Related Topics
- [react-native-architecture.md](./react-native-architecture.md)
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [hermes-engine.md](./hermes-engine.md)
- [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md)
- [core-components.md](./core-components.md)
- [../React/introduction-to-react.md](../React/introduction-to-react.md)
- [../React/jsx.md](../React/jsx.md)
- [../React/components.md](../React/components.md)
