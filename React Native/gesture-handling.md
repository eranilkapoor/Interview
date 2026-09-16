# Gesture Handling

React Native ships with a built-in touch system — `PanResponder` and the low-level `Touchable*` components — that recognizes touches by routing raw touch events from the native side across the bridge to JavaScript, where your handlers decide what the gesture means (a tap, a drag, a swipe) and compute the resulting UI updates. The problem is architectural: every touch event, and every decision about what to do with it, has to travel to the JS thread and back. If the JS thread is busy (an in-flight render, a heavy computation, a dropped frame during a state update), touch handling stalls too, and gesture-driven UI — a draggable card, a swipeable row, a pinch-to-zoom image — visibly stutters or lags behind your finger. `PanResponder` also has a notoriously awkward, callback-heavy API (`onMoveShouldSetPanResponder`, `onPanResponderMove`, and so on) that makes anything beyond a simple drag hard to reason about.

`react-native-gesture-handler` solves both problems. Instead of routing raw touches through JS and asking your code to interpret them, it uses the platform's native gesture recognition systems (`UIGestureRecognizer` on iOS, similar APIs on Android) to detect gestures directly on the native side, and only crosses the bridge (or, with the New Architecture, communicates via JSI) with already-classified gesture state — "this is now a pan, here's the current translation." Combined with `react-native-reanimated`, gesture handling and the resulting animation can run almost entirely on the UI thread, completely decoupled from whatever the JS thread happens to be doing, which is what makes gesture-driven interactions in modern React Native apps feel as smooth as native ones.

The library ships two API styles. The older one mirrors `PanResponder` fairly closely with component wrappers (`PanGestureHandler`, `TapGestureHandler`, etc.) and imperative refs for composing them. The modern, recommended style is the **Gesture API**: you build a gesture description with factory functions like `Gesture.Pan()`, `Gesture.Tap()`, `Gesture.LongPress()`, `Gesture.Pinch()`, and `Gesture.Fling()`, chain configuration and callbacks onto them (`.onStart()`, `.onUpdate()`, `.onEnd()`), and attach the result to a view with a single `<GestureDetector gesture={...}>` wrapper. Multiple gestures compose declaratively — `Gesture.Simultaneous(panGesture, pinchGesture)`, `Gesture.Race(...)`, `Gesture.Exclusive(...)` — instead of hand-rolling coordination logic.

The five core recognizers cover most real interactions: **Tap** (single or multi-tap, configurable tap count and max duration), **Pan** (dragging, reporting continuous translation and velocity), **LongPress** (press-and-hold past a duration threshold, used for context menus and drag-initiation), **Pinch** (two-finger scale, for zoom), and **Fling** (a fast, short swipe in a given direction, distinct from a slow deliberate pan). Each exposes rich state — translation, velocity, scale, focal point — inside its callbacks, and because those callbacks are typically written as Reanimated "worklets" (functions marked to run on the UI thread), the gesture recognition, the animation driven by it, and the final rendered position can all happen in the same thread, in the same frame, with zero round trips to JS.

## Examples

```jsx
// Basic Tap and Pan gestures with the modern Gesture API
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

function DraggableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      // Snap back to origin with a spring animation
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]} />
    </GestureDetector>
  );
}
```

```jsx
// Composing gestures: a double-tap-to-like combined with a pinch-to-zoom
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';

function PhotoViewer() {
  const scale = useSharedValue(1);
  const liked = useSharedValue(false);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      liked.value = !liked.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = event.scale;
    })
    .onEnd(() => {
      scale.value = withTiming(1); // reset zoom
    });

  // Race: whichever gesture is recognized first "wins" for that touch
  const composed = Gesture.Race(doubleTap, pinch);

  return (
    <GestureDetector gesture={composed}>
      {/* Animated.Image driven by `scale` via useAnimatedStyle, omitted for brevity */}
      <PhotoContent />
    </GestureDetector>
  );
}
```

```jsx
// LongPress to initiate a drag-and-drop reorder interaction
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';

function ReorderableItem({ onDragStart, onDragEnd }) {
  const isActive = useSharedValue(false);
  const offsetY = useSharedValue(0);

  const longPress = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      isActive.value = true;
      onDragStart();
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (isActive.value) offsetY.value = event.translationY;
    })
    .onEnd(() => {
      isActive.value = false;
      offsetY.value = withTiming(0);
      onDragEnd();
    });

  // Simultaneous: the long-press activates first, then the pan takes over
  const composed = Gesture.Simultaneous(longPress, pan);

  return (
    <GestureDetector gesture={composed}>
      <ItemRow />
    </GestureDetector>
  );
}
```

## Common Pitfalls / Gotchas

- Forgetting to wrap the app root in `GestureHandlerRootView` (from `react-native-gesture-handler`) — without it, gestures silently fail to register on Android, and some interactions (like swipe-to-go-back) can misbehave on iOS too.
- Writing gesture callbacks as plain JS functions that call `setState` directly instead of Reanimated worklets updating shared values — this routes every gesture update back through the JS thread and React's render cycle, defeating the entire performance benefit of using the library.
- Not understanding gesture composition semantics: `Gesture.Simultaneous` lets all listed gestures recognize at once, `Gesture.Exclusive` lets only the first-listed one "win" if it activates, and `Gesture.Race` lets whichever recognizes first win — picking the wrong one produces gestures that either fight each other or fail to fire at all.
- Nesting a `ScrollView`/`FlatList` inside a view with its own pan gesture (or vice versa) without configuring `simultaneousHandlers` or the newer gesture composition — the scroll view and the custom gesture end up fighting over which one "owns" the touch.
- Mixing the legacy component-based API (`PanGestureHandler`, imperative refs) with the modern `Gesture`/`GestureDetector` API in the same codebase inconsistently, which makes gesture composition and debugging much harder than sticking to one style.
- Forgetting that `onUpdate`/`onStart`/`onEnd` callbacks passed to `Gesture.*` run as worklets on the UI thread — referencing JS-thread-only values or calling non-worklet functions from inside them (without `runOnJS`) throws at runtime.

## Interview Questions & Answers

**Q: Why does `react-native-gesture-handler` exist when React Native already has `PanResponder`?**
A: `PanResponder` funnels every raw touch event through the JS thread for interpretation, so gesture responsiveness is only as good as whatever else the JS thread is doing at that moment — any JS-side work causes visible jank in the gesture. `react-native-gesture-handler` uses the platform's native gesture recognizers to detect and classify gestures on the native side, crossing into JS (or, with Reanimated worklets, staying on the UI thread entirely) only with already-recognized gesture state, which keeps gesture handling smooth regardless of JS thread load.

**Q: What is `GestureDetector` and how does it relate to the `Gesture` factory functions?**
A: `Gesture.Pan()`, `Gesture.Tap()`, etc. build a declarative gesture configuration object (with callbacks and options chained on). `GestureDetector` is the single component that takes that configuration via its `gesture` prop and attaches the underlying native gesture recognition to its child view — replacing the older pattern of wrapping a view in a separate `PanGestureHandler`/`TapGestureHandler` component per gesture type.

**Q: How do you make a pan gesture drive a smooth, native-thread animation?**
A: Update a Reanimated `useSharedValue` inside the gesture's `onUpdate` callback (which runs as a worklet on the UI thread), and read that shared value inside a `useAnimatedStyle` hook applied to an `Animated.View`. Because the gesture recognition, the shared value update, and the style recomputation all happen on the UI thread without crossing back to JS, the animation stays in sync with the user's finger even under JS thread load.

**Q: What's the difference between `Gesture.Simultaneous`, `Gesture.Exclusive`, and `Gesture.Race`?**
A: `Simultaneous` allows all composed gestures to be recognized and active at the same time (e.g., pan and pinch together on a photo). `Exclusive` gives priority to the first-listed gesture — later ones only activate if the first one fails to. `Race` lets whichever gesture is recognized first "win" the touch, cancelling the others (e.g., distinguishing a tap from the start of a pan).

**Q: Why is `react-native-gesture-handler` almost always paired with `react-native-reanimated`?**
A: Gesture Handler is responsible for recognizing and classifying gestures natively; Reanimated is responsible for running the resulting animation logic as worklets directly on the UI thread. Used together, the entire pipeline — from raw touch to recognized gesture to animated visual update — stays off the JS thread, which is what produces native-feeling, jank-free gesture-driven UI. Using Gesture Handler alone with `setState`-based updates reintroduces the JS-thread bottleneck it was designed to avoid.

## Related Topics
- [animations.md](./animations.md)
- [performance-optimization.md](./performance-optimization.md)
- [core-components.md](./core-components.md)
- [../React/handling-events.md](../React/handling-events.md)
- [../React/use-ref.md](../React/use-ref.md)
