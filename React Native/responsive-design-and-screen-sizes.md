# Responsive Design and Screen Sizes

React Native has no viewport meta tag, no CSS media queries, and no browser layout engine — every layout is computed once via Yoga (RN's Flexbox implementation) against whatever dimensions the native window/screen reports, so "responsive design" in RN means explicitly reading device dimensions and either laying out proportionally (percentages, `flex`) or branching logic based on the numbers you get back. The `Dimensions` API (`Dimensions.get('window')` and `Dimensions.get('screen')`) is the original way to read these numbers: `'window'` returns the dimensions of the app's visible drawing area (excluding, on Android, things like the status bar/navigation bar in some configurations), while `'screen'` returns the full physical screen dimensions regardless of app chrome. On most modern phones these two are close to identical, but they diverge meaningfully on Android devices with soft navigation bars, in split-screen/multi-window mode, and with foldables. Critically, `Dimensions.get(...)` is a **synchronous, one-time snapshot** — it is not reactive. If you call it once during initial render and store the result, and the user then rotates the device or enters split-screen, your captured values go stale; nothing about calling `Dimensions.get` subscribes your component to future changes.

To react to dimension changes, RN offers two mechanisms: the older `Dimensions.addEventListener('change', handler)` (which requires manual subscription and cleanup, much like `AppState`'s listener pattern), and the newer, now-preferred `useWindowDimensions()` hook, which returns `{ width, height, scale, fontScale }` and automatically re-renders your component whenever any of those values change — no manual subscription, no cleanup, no stale-closure risk. For any layout value that needs to respond to rotation, split-screen resizing, or a foldable's hinge state, `useWindowDimensions` is the correct default; `Dimensions.get` is appropriate only for one-off reads where staleness genuinely doesn't matter (e.g., a value used once during a native module bridge call that isn't tied to a component's render output).

Handling safe areas — the notch, Dynamic Island, home indicator, status bar, and Android's cutouts/gesture navigation — is a related but distinct problem from dimensions. RN ships a `SafeAreaView` component, but it's a much weaker tool than its name suggests: it originated as an iOS-only wrapper around `UIView`'s `safeAreaLayoutGuide` and, even where it does something on Android, its behavior has historically been inconsistent and limited (no reliable inset values you can read and use in custom calculations, no support for insets changing dynamically, e.g., on rotation). The community-standard replacement is `react-native-safe-area-context`, which wraps the app in a `SafeAreaProvider` and exposes the `useSafeAreaInsets()` hook, returning precise `{ top, right, bottom, left }` pixel values for the current device/orientation on both platforms — letting you apply exactly the padding you need (e.g., `paddingTop: insets.top` on a custom header) rather than relying on an opaque wrapper component. Most production navigation libraries, including React Navigation, depend on `react-native-safe-area-context` internally, so it's typically already in the dependency tree even if you haven't reached for it directly.

For actual layout strategy, RN encourages Flexbox-first, proportional layouts over fixed-pixel ones wherever possible — using `flex: 1`, `flexGrow`/`flexShrink`, and percentage string values (`width: '50%'`) for containers that should adapt to available space, reserving fixed pixel values for things that genuinely shouldn't scale (icon sizes, border widths, a minimum touch target of 44/48px). Where pixel-perfect, density-aware sizing matters — matching a design spec that assumes a specific DPI, or converting a design tool's point values into hairline-accurate borders — `PixelRatio` provides `PixelRatio.get()` (the device's pixel density multiplier, e.g., 2 or 3 on most modern phones) and helpers like `PixelRatio.getPixelSizeForLayoutSize()` and `PixelRatio.roundToNearestPixel()` for snapping values to whole physical pixels, avoiding blurry sub-pixel rendering on borders and fine lines. Orientation changes are really just a special case of the dimensions-reactivity problem: `useWindowDimensions`'s `width`/`height` values swap when the device rotates, so orientation-dependent layout logic (e.g., "show a two-column grid in landscape, one column in portrait") is typically written as a plain comparison (`width > height`) recomputed on every render from the hook's live values, rather than any separate "orientation" API.

## Examples

```jsx
// Dimensions.get is a stale, one-time snapshot — this breaks on rotation
import { Dimensions, View, Text } from 'react-native';

const { width, height } = Dimensions.get('window'); // captured once, at module load

function BrokenOrientationBanner() {
  // width/height never update here even if the device rotates after this module loads
  return (
    <View>
      <Text>{width > height ? 'Landscape (maybe stale!)' : 'Portrait (maybe stale!)'}</Text>
    </View>
  );
}
```
This is the classic bug: capturing `Dimensions.get('window')` at module scope (or once in a component without a listener) means the values are frozen at whatever they were on first read, so rotating the device or entering split-screen never updates this banner.

```jsx
// useWindowDimensions: reactive, correctly re-renders on rotation/split-screen
import { useWindowDimensions, View, Text } from 'react-native';

function OrientationAwareGrid({ items }) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = isLandscape ? 4 : 2;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((item) => (
        <View key={item.id} style={{ width: `${100 / numColumns}%`, padding: 4 }}>
          <Text>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
```
Because `useWindowDimensions` subscribes the component to live dimension changes, `numColumns` automatically recalculates and the component re-renders whenever the device rotates or the window is resized (e.g., Android split-screen) — no manual listener setup required.

```jsx
// react-native-safe-area-context: precise, cross-platform inset handling
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StatusBar } from 'react-native';

function CustomHeader({ title }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: '#1e293b' }}>
      <View style={{ height: 56, justifyContent: 'center', paddingHorizontal: 16 }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{title}</Text>
      </View>
    </View>
  );
}

// Wrap the app root once, typically alongside your navigation container
function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <CustomHeader title="Home" />
      {/* rest of the app */}
    </SafeAreaProvider>
  );
}
```
`useSafeAreaInsets()` gives exact pixel values for the notch/status bar/home-indicator area on both platforms, which is what lets a fully custom header (rather than RN's own `SafeAreaView`) apply exactly the right amount of top padding instead of guessing a fixed value that breaks on devices with different notch/inset geometry.

## Common Pitfalls / Gotchas

- Calling `Dimensions.get('window')` once at module scope or in initial state and never updating it — this value goes stale the instant the device rotates, enters split-screen, or (on a foldable) changes hinge angle, and nothing re-renders your component to reflect the new size.
- Confusing `Dimensions.get('window')` with `Dimensions.get('screen')` — on Android especially, these can differ (navigation bar, split-screen, cutouts), and using the wrong one leads to layouts that are off by the height of a system bar.
- Using RN's built-in `SafeAreaView` and assuming it behaves identically and reliably on both platforms — its cross-platform support and inset accuracy are limited compared to `react-native-safe-area-context`, and it doesn't expose raw inset numbers you can use in custom math (e.g., "header height plus half the top inset").
- Forgetting to wrap the app in `SafeAreaProvider` before using `useSafeAreaInsets()` — the hook throws or returns incorrect zeroed values without a provider ancestor in the tree.
- Hardcoding pixel values copied directly from a design tool (like a 1px border) without considering `PixelRatio` — a literal `1` may render as a blurry, sub-pixel-antialiased line on higher-density screens instead of a crisp hairline.
- Building layouts entirely from percentage widths without testing on both a small phone and a tablet — percentages solve proportional scaling but don't prevent absurd results at extreme sizes (e.g., a 50%-width card that's fine on a phone but tiny and awkwardly placed on a tablet); some breakpoint-style branching on `useWindowDimensions().width` is often still needed.
- Reading `useWindowDimensions()` inside a deeply memoized/`React.memo`-wrapped component and assuming it won't cause re-renders — it deliberately will, on every dimension change, which is correct behavior but can be a performance surprise if that subtree is expensive to re-render and the dependency wasn't intentional.

## Interview Questions & Answers

**Q: Why is `Dimensions.get('window')` described as "not reactive," and what problem does that cause in practice?**
A: `Dimensions.get(...)` is a synchronous function call that returns the current dimensions at the exact moment it's called — it doesn't subscribe the calling component to future changes, so if you call it once (e.g., in module scope or as initial `useState`) and the device later rotates or enters split-screen, the value you're holding onto is now wrong and nothing triggers a re-render to fix it. In practice this shows up as layouts that look correct on first render but don't adapt when the user rotates their phone, which is why `useWindowDimensions()` — which does trigger re-renders on change — is the preferred API for anything actually rendered in JSX.

**Q: What's the difference between `Dimensions.get('window')` and `Dimensions.get('screen')`?**
A: `'window'` returns the dimensions of the app's own visible drawing area, which can exclude system UI like an Android navigation bar depending on configuration, while `'screen'` returns the full physical display dimensions regardless of app chrome. They're usually close to identical on iOS and on most Android phones in normal full-screen mode, but they diverge on Android devices with soft navigation bars, in split-screen/multi-window mode, and on foldables, so picking the wrong one can introduce a layout offset equal to the height of a system bar.

**Q: Why would you use `react-native-safe-area-context` instead of RN's built-in `SafeAreaView`?**
A: RN's built-in `SafeAreaView` originated as a fairly thin, historically iOS-focused wrapper with limited and inconsistent cross-platform behavior, and it doesn't expose the actual inset values as numbers you can use in custom layout math. `react-native-safe-area-context`'s `useSafeAreaInsets()` hook gives you precise `{top, right, bottom, left}` pixel values for the current device and orientation on both platforms, which is what lets you build fully custom components (like a header with a specific background color extending under the status bar) that still respect the exact safe-area geometry, and it's also what most navigation libraries like React Navigation rely on internally.

**Q: What does `PixelRatio` solve, and when would you actually need it?**
A: `PixelRatio` exposes the device's pixel density multiplier (`PixelRatio.get()`, e.g., 2x or 3x on most modern phones) and helpers to convert between RN's density-independent layout units and actual physical device pixels. You'd reach for it when you need pixel-perfect precision that a plain point value can't guarantee — most commonly, snapping a hairline border to exactly one physical pixel (`PixelRatio.roundToNearestPixel(...)`) so it renders crisp rather than blurry/anti-aliased across a sub-pixel boundary, or when matching a design spec that was authored against a specific device density.

**Q: How would you build a layout that shows two columns in portrait and four columns in landscape?**
A: Use `useWindowDimensions()` to get live `width`/`height` values, compare them (`width > height` generally indicates landscape), and derive the column count from that comparison directly in the render — since the hook re-renders the component automatically on rotation, the derived column count and any percentage-based item widths recompute correctly with no extra listener code. This is preferable to trying to detect "orientation" as a separate named concept, since RN doesn't expose an orientation API distinct from the dimensions themselves — orientation is just an interpretation of the current width/height relationship.

## Related Topics
- [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md)
- [styling-in-react-native.md](./styling-in-react-native.md)
- [core-components.md](./core-components.md)
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [platform-specific-code.md](./platform-specific-code.md)
- [../React/use-effect.md](../React/use-effect.md)
