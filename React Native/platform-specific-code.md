# Platform-Specific Code

React Native's promise is "learn once, write anywhere" rather than "write once, run anywhere" — the framework deliberately expects that some fraction of your code will need to diverge between iOS and Android (and, if you target it, web) because the underlying platforms genuinely behave differently: different navigation conventions, different permission dialogs, different native components, different design languages (Human Interface Guidelines vs. Material Design), and occasionally different capabilities entirely. React Native gives you two complementary mechanisms for handling this divergence, and picking the right one for the size of the difference is a real, practical skill that comes up constantly in day-to-day RN work.

The first mechanism is the `Platform` module, imported from `react-native`, which is the right tool for small, inline differences. `Platform.OS` is a string (`'ios'`, `'android'`, and also `'web'`/`'windows'`/`'macos'` on the community-maintained out-of-tree platforms) you can branch on directly with an `if` or ternary. `Platform.select({ ios: ..., android: ..., default: ... })` is a more declarative way to express the same branching — it takes an object keyed by platform name (plus an optional `default` fallback) and returns whichever value matches the current platform at the point it's called, which makes it especially convenient inline inside a `StyleSheet.create` call or a props object, since you don't need a separate `if` block breaking up your JSX. `Platform.Version` gives you the OS version number (an integer API level on Android, a version string like `'17.0'` on iOS), which matters because some APIs or permission behaviors are gated by OS version rather than just OS name — the canonical example being that Android's runtime permission model only applies from API 23 onward, so code that branches on `Platform.Version` alongside `Platform.OS` shows up regularly in permissions and native-module code.

The second mechanism is platform-specific file extensions: naming a file `Component.ios.js` and `Component.android.js` (or `.tsx` for TypeScript) lets Metro, RN's bundler, automatically resolve `import Component from './Component'` to the correct file for whichever platform is currently being built — no conditional logic, and no import path changes required anywhere else in the codebase. `.native.js` is a third useful suffix: it matches both iOS and Android (as opposed to web, when you're using a tool like React Native Web), so a common pattern is `Component.native.js` + `Component.web.js` to split "any RN platform" from "web," with a bare `Component.js` sometimes present as a default/fallback the resolver falls back to only if no more specific match exists. This mechanism is the right tool when the platform difference is large enough that cramming it into one file with `Platform.select`/`Platform.OS` branches would hurt readability — an entire component whose layout, native APIs, or interaction pattern genuinely differs per platform (think a native-feeling iOS action sheet vs. an Android bottom sheet, or two completely different native SDK integrations) is far more maintainable as two separate files than as one file riddled with `if (Platform.OS === 'ios')` blocks.

The practical rule of thumb interviewers are usually probing for: reach for `Platform.select`/`Platform.OS` when the difference is a handful of style values, a slightly different prop, or a couple of lines of logic inside an otherwise-shared component; reach for separate `.ios`/`.android` files when the divergence is structural — different component trees, different native modules being wrapped, or enough platform-specific logic that a single file becomes hard to follow. It's also worth knowing these two mechanisms compose: it's completely normal for a `Component.ios.js`/`Component.android.js` pair to each still use `Platform.select` internally for smaller version-specific tweaks, or for a shared component to use `Platform.select` for 90% of its platform differences while delegating one particularly divergent piece of UI to a separate platform-specific subcomponent.

## Examples

```jsx
// Platform.OS and Platform.select for small, inline differences
import { Platform, StyleSheet, View, Text } from 'react-native';

function Header({ title }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 44 : 24, // status bar height differs per platform
    backgroundColor: Platform.select({
      ios: '#f8f8f8',
      android: '#ffffff',
      default: '#ffffff',
    }),
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 4 }, // Android uses elevation, not shadow props
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
  },
});
```

```jsx
// Gating behavior by OS version, not just OS name
import { Platform } from 'react-native';

function supportsNewPermissionFlow() {
  // Android's runtime permission model only exists from API 23 onward
  if (Platform.OS === 'android') {
    return Platform.Version >= 23;
  }
  return true; // iOS has had runtime prompts for the relevant APIs for a long time
}
```

```jsx
// Platform-specific files: ActionSheet.ios.js and ActionSheet.android.js
// Both are imported identically from anywhere else in the app:
import ActionSheet from './ActionSheet';

// ActionSheet.ios.js
import { ActionSheetIOS } from 'react-native';
export default function ActionSheet({ options, onSelect }) {
  const show = () =>
    ActionSheetIOS.showActionSheetWithOptions({ options }, onSelect);
  return show;
}

// ActionSheet.android.js
import { ToastAndroid } from 'react-native';
// Android has no native action sheet API in core RN, so this platform
// implements the same conceptual UI with a bottom sheet library instead.
import BottomSheet from 'some-bottom-sheet-lib';
export default function ActionSheet({ options, onSelect }) {
  const show = () => BottomSheet.show({ options, onSelect });
  return show;
}
```

## Common Pitfalls / Gotchas

- Overusing `Platform.select`/`Platform.OS` branches until a component becomes an unreadable maze of conditionals — past a certain point, splitting into `.ios`/`.android` files is the more maintainable choice, not a stylistic preference.
- Forgetting that `.native.js` matches both iOS and Android, so a stray `Component.native.js` alongside a `Component.ios.js` can create ambiguous or unexpected resolution — Metro resolves the most specific matching extension for the current platform, so keep the set of files for one component consistent (don't mix a `.native.js` sibling in with per-OS files for the same component name).
- Branching only on `Platform.OS` when the real constraint is OS version (e.g., an Android API that only exists from API 31 onward) — leads to runtime crashes on older devices that pass the `Platform.OS === 'android'` check but not the actual capability check.
- Assuming `Platform.select`'s `default` key is always used — it's only used when no key for the *current* platform matches; if you target web via React Native Web and only specify `ios`/`android`, web falls through to `default` or to `undefined` if there's no `default`, which can silently produce missing styles.
- Reaching for `Platform.OS` checks to work around a difference that a cross-platform library already handles correctly (e.g., safe-area insets, which `react-native-safe-area-context` computes for you) — reinventing that logic by hand tends to drift out of sync with real device behavior over OS updates.
- Testing only on one platform during development and only checking the other right before a release — platform-specific files and `Platform.select` branches are exactly the code most likely to have never been exercised on the platform you didn't run locally.

## Interview Questions & Answers

**Q: What's the difference between `Platform.select` and using platform-specific file extensions, and how do you decide which to use?**
A: `Platform.select` branches *within* a single file/module, and is best for small, localized differences — a style value, a prop, a few lines of logic. Platform-specific file extensions (`.ios.js`/`.android.js`/`.native.js`/`.web.js`) let the bundler pick an entirely different file at build/import time with no code-level branching required, which is the better choice once the divergence is structural enough (different component trees, different native modules) that inline branching would hurt readability. The rule of thumb is: small and inline → `Platform.select`; large and structural → separate files.

**Q: How does Metro know to resolve `import X from './X'` to `X.ios.js` on iOS?**
A: Metro's module resolver checks for platform-specific extensions before falling back to the bare filename, in priority order roughly: `X.ios.js` (or `.android.js`) for the exact platform being bundled, then `X.native.js` for any non-web RN platform, then `X.js` as the generic fallback. This resolution happens automatically at bundle time based on which platform is being built, so no import path in the rest of the codebase needs to know or care which file actually gets used.

**Q: Why would you check `Platform.Version` in addition to `Platform.OS`?**
A: Because platform behavior isn't just a function of iOS vs. Android — it also varies by OS version. The most common example is Android's runtime permission model, which only applies starting at API level 23; code that assumes all Android devices behave the same regardless of version can crash or misbehave on older or newer OS releases where a given API, permission flow, or behavior differs. `Platform.Version` gives you the actual OS version (an API level integer on Android, a version string on iOS) to gate that logic precisely.

**Q: Give an example of a case where you'd choose separate platform files over `Platform.select`.**
A: Wrapping a native map SDK or native UI component that has genuinely different native implementations per platform (e.g., different underlying native views, different native modules, different prop shapes) — trying to express that with `Platform.select` inside one file means the file imports both platforms' native dependencies and branches at runtime, which is wasteful and confusing. Splitting into `MapView.ios.js` and `MapView.android.js` lets each file only import what that platform actually needs, and keeps each platform's implementation readable on its own.

**Q: Does `Platform.select` evaluate lazily per-platform, or does it always evaluate every branch?**
A: The object literal passed to `Platform.select` is a normal JS object, so every value in it is evaluated eagerly when the object is constructed (all branches' expressions run), and `Platform.select` simply picks which *already-evaluated* value to return based on the current platform. This matters if a branch's value comes from calling a function with side effects or importing something expensive — that cost is paid on every platform, not just the one selected, so avoid putting non-trivial computation directly inline inside a `Platform.select` object.

## Related Topics
- [core-components.md](./core-components.md)
- [styling-in-react-native.md](./styling-in-react-native.md)
- [native-modules.md](./native-modules.md)
- [native-ui-components.md](./native-ui-components.md)
- [expo-vs-bare-workflow.md](./expo-vs-bare-workflow.md)
- [responsive-design-and-screen-sizes.md](./responsive-design-and-screen-sizes.md)
