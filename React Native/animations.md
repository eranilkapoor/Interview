# Animations

React Native ships a built-in `Animated` API for driving UI changes over time — think moving, fading, scaling, or resizing elements in response to state changes, gestures, or app events. At its core is `Animated.Value`, a special mutable container for a number (or `Animated.ValueXY` for a pair) that Animated components read from instead of a plain prop; you drive it with an animation function — `Animated.timing` (duration-based easing toward a target), `Animated.spring` (physics-based, settles naturally with configurable tension/friction), or `Animated.decay` (starts at a velocity and decelerates to a stop, useful after a fling gesture) — and call `.start()` to run it. Because `Animated.Value` updates are declarative and tracked by the library rather than being plain `setState` calls, React Native can, under certain conditions, hand the entire animation off to the native side.

That handoff is `useNativeDriver: true`, arguably the single most important flag in the whole API. When set, Animated serializes the animation's configuration once at the start and sends it to the native UI thread, which then runs the animation frame-by-frame itself — completely independent of the JS thread. This means the animation keeps running smoothly even if the JS thread is busy (blocked on a network response, a heavy render, whatever), which is a categorical improvement over JS-driven animation. The catch is that the native driver can only animate non-layout properties — primarily `transform` (translate, scale, rotate) and `opacity` — because only those can be applied directly by the native rendering layer without re-running React Native's layout engine (Yoga) on the JS side. Animating `width`, `height`, `top`, `left`, or other layout-affecting properties still requires `useNativeDriver: false`, which means those animations run on the JS thread and are subject to jank under JS thread contention.

`react-native-reanimated` takes a fundamentally different approach: instead of pre-serializing a fixed animation description and handing it to native, you write your animation logic as JavaScript functions — "worklets" — that Reanimated's Babel plugin compiles to run directly on the UI thread, alongside layout and gesture processing, with no bridge round-trip at all. The core primitives are `useSharedValue` (a UI-thread-accessible value, analogous to `Animated.Value` but readable/writable from worklets), `useAnimatedStyle` (a hook that recomputes a style object as a worklet whenever the shared values it reads change), and animation helpers like `withTiming`, `withSpring`, and `withDecay` that mirror `Animated.timing`/`spring`/`decay` but run entirely on the UI thread. Because the actual animation logic — not just a pre-baked config — executes on the UI thread, Reanimated can express things the basic `Animated` API plus native driver fundamentally cannot: animations that respond to layout, animations chained with conditional/interpolated logic evaluated per frame, and — critically — gesture-driven animation, since `react-native-gesture-handler`'s gesture callbacks can update shared values directly on the UI thread in the same frame the gesture updates.

The practical rule of thumb: reach for the built-in `Animated` API with `useNativeDriver: true` for simple, self-contained animations on `transform`/`opacity` — a fade-in, a button press scale, a simple slide transition — where its more verbose, imperative-feeling API is not a real cost. Reach for `react-native-reanimated` once you need to animate a layout property smoothly, need an animation driven directly by a continuous gesture (a swipeable card, a bottom sheet that follows your finger and then springs), need to interpolate multiple values together with custom per-frame logic, or find yourself fighting the native driver's opacity/transform-only restriction. In practice, most non-trivial React Native apps standardize on Reanimated for anything beyond the simplest fades and taps, precisely because it removes the "which properties can I even animate on the native thread" ceiling entirely.

## Examples

```jsx
// Built-in Animated API: a simple native-driven fade-in
import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

function FadeInView({ children }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true, // opacity is a supported native-driver property
    }).start();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
```

```jsx
// Reanimated: a spring-driven scale animation on press, entirely on the UI thread
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

function PressableCard({ children, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.95))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={onPress}
    >
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </Pressable>
  );
}
```

```jsx
// Reanimated: animating a layout property (height) — not possible with
// the basic Animated API + useNativeDriver, since height affects layout
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

function CollapsibleSection({ expanded, children }) {
  const height = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(expanded ? height.value : 0, { duration: 250 }),
    overflow: 'hidden',
  }));

  return (
    <Animated.View
      style={animatedStyle}
      onLayout={(e) => {
        // Capture natural content height once, to animate toward it
        if (height.value === 0) height.value = e.nativeEvent.layout.height;
      }}
    >
      {children}
    </Animated.View>
  );
}
```

## Common Pitfalls / Gotchas

- Trying to set `useNativeDriver: true` on an animation that touches `width`, `height`, `top`, `left`, or other layout properties — this throws an error at runtime, since the native driver only supports `transform` and `opacity`.
- Mixing native-driven and JS-driven animations on properties that need to stay visually in sync — they run on different threads with different timing guarantees, so they can drift out of sync under load.
- Creating a new `Animated.Value` on every render (instead of via `useRef`) — this resets the animation's state each render instead of persisting it across the component's lifetime.
- Forgetting the Reanimated Babel plugin (`react-native-reanimated/plugin`) in `babel.config.js` — without it, worklets aren't compiled correctly and shared-value updates silently fail to run on the UI thread.
- Reading a `.value` from a Reanimated shared value directly in a component's JSX/render body (instead of inside `useAnimatedStyle` or another worklet context) — this doesn't trigger a re-render the way `useState` would and is a common source of "why isn't my UI updating" confusion.
- Calling non-worklet JavaScript (e.g., `setState`, navigation calls, analytics) directly inside a Reanimated worklet without wrapping it in `runOnJS` — worklets run on the UI thread and cannot call arbitrary JS-thread functions directly.
- Overusing `Animated.decay` without tuning its deceleration constant, producing a fling animation that either stops too abruptly or drifts unnaturally far.

## Interview Questions & Answers

**Q: What does `useNativeDriver: true` actually do, and why can't it be used for every animation?**
A: It hands the animation's configuration to the native UI thread once, up front, so the animation runs frame-by-frame natively instead of being driven by repeated JS-thread updates — making it immune to JS thread jank. It's restricted to non-layout properties (`transform`, `opacity`) because those are the only properties the native rendering layer can apply directly without re-running the JS-side layout engine (Yoga); animating layout properties natively would require layout recalculation to also happen on the native thread, which the basic `Animated` API doesn't support.

**Q: How does `react-native-reanimated` differ architecturally from the built-in `Animated` API, even with `useNativeDriver` enabled?**
A: `Animated` with the native driver still only pre-serializes a fixed animation description (interpolation, duration, easing) that native code executes — the animation *logic* still effectively originates from a JS-described config. Reanimated compiles your actual animation-related JavaScript (worklets) to run directly on the UI thread via its own JS engine instance there, so arbitrary per-frame logic, conditionals, and interpolation between multiple shared values can all execute natively, not just a pre-baked timing curve.

**Q: Why is `react-native-reanimated` the standard choice for gesture-driven animations?**
A: Because gesture recognition (via `react-native-gesture-handler`) and Reanimated's worklets both execute on the UI thread, a gesture's `onUpdate` callback can write directly to a shared value in the same frame, with `useAnimatedStyle` immediately reflecting it — no bridge round-trip to JS and back. The basic `Animated` API has no equivalent mechanism to update in native-thread-synchronous lockstep with continuous gesture input.

**Q: When would you still choose the built-in `Animated` API over Reanimated?**
A: For simple, self-contained animations restricted to `opacity`/`transform` — fades, simple scale/translate transitions, staggered entrance animations — where `useNativeDriver: true` already delivers smooth, native-thread performance and pulling in Reanimated's extra setup (Babel plugin, worklet mental model) isn't buying you anything. Many teams still standardize on Reanimated everywhere for consistency, but it's not strictly required for the simple cases.

**Q: What is a "worklet" in Reanimated?**
A: A JavaScript function specially marked (automatically, via the Babel plugin, for functions passed to Reanimated APIs like `useAnimatedStyle` or gesture callbacks) to be compiled and run on the UI thread instead of the JS thread. Worklets can read/write shared values directly and run in sync with rendering and gesture processing, but they run in a restricted JS environment and need `runOnJS` to call back into regular JS-thread code.

## Related Topics
- [gesture-handling.md](./gesture-handling.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [hermes-engine.md](./hermes-engine.md)
- [react-native-architecture.md](./react-native-architecture.md)
- [../React/use-ref.md](../React/use-ref.md)
- [../React/react-performance-optimization.md](../React/react-performance-optimization.md)
