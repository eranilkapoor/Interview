# Performance Optimization in React Native

Performance work in React Native happens on two levels at once: the same React-level render optimizations you'd apply on the web (`React.memo`, `useMemo`, `useCallback`) still matter, but they matter *more* here because the consequences are visually blunt. On the web, a wasted re-render might cost a few extra milliseconds nobody notices. On a mobile device targeting 60fps, the JS thread has roughly 16ms per frame to do its work before the frame is dropped, and a dropped frame during a scroll or a gesture is immediately, physically obvious to the user as a stutter — there's no "it's probably fine" on mobile the way there sometimes is on a desktop browser. `React.memo` skips re-rendering a component when its props haven't changed (by shallow comparison), which matters most for list rows and other components rendered many times; `useMemo` avoids recomputing an expensive value on every render; `useCallback` keeps a function reference stable across renders so that a `React.memo`-wrapped child receiving it as a prop doesn't see a "new" prop and re-render anyway. None of these are free — memoization has its own comparison cost — so the practical rule is the same as on the web: reach for them where profiling shows a real cost (large lists, expensive computations, components deep in a frequently-updating tree), not reflexively on every component.

`FlatList` is the single highest-leverage performance surface in most RN apps, because almost every screen has a scrollable list somewhere and a naive list is the most common source of visible jank. `FlatList` virtualizes by default — it only mounts rows near the visible viewport and unmounts rows far from it — but the tuning props control exactly how aggressive that virtualization is. `initialNumToRender` sets how many rows render on first mount, before anything is scrolled; too high delays the first paint, too low shows blank space if the user scrolls immediately. `maxToRenderPerBatch` caps how many rows are rendered per batch as the user scrolls (rendering happens in batches, off the main scroll-handling work, to avoid blocking the UI); `windowSize` controls how many "screens" worth of content are kept mounted above and below the visible area, expressed as a multiple of the viewport height (the default is 21, meaning roughly 10 screens above, 10 below, plus the visible one) — a smaller `windowSize` uses less memory and renders less, at the cost of more visible blank flashes if the user scrolls fast. `removeClippedSubviews` (Android-primarily, though it exists on iOS too) unmounts views that are scrolled fully off-screen at the *native* view layer, freeing native memory more aggressively than JS-level virtualization alone — it can occasionally cause rendering glitches with certain view hierarchies, so it's opt-in rather than default-on. `getItemLayout` is the biggest single win when it applies: for lists where every row has a **fixed, known height**, providing `getItemLayout` tells `FlatList` the exact offset and height of every row up front, so it can skip the async measurement pass entirely, jump directly to any offset (critical for `scrollToIndex`), and compute what's visible synchronously rather than waiting for layout callbacks — the cost is that it only works when row height is fixed and known ahead of time, which rules it out for variable-height content like chat bubbles or dynamic cards.

Image handling and Hermes bytecode precompilation are both significant performance levers covered in depth elsewhere in this folder — see [image-and-media-handling.md](./image-and-media-handling.md) for sizing, caching, and format choices, and [hermes-engine.md](./hermes-engine.md) for how Hermes precompiles JS to bytecode ahead of time so app startup doesn't pay the cost of parsing and compiling JS on every launch, the way a JS-engine-default (JSC) setup would. The short version worth repeating here: both are "do this once, benefit on every screen" optimizations, unlike list tuning or memoization, which are per-component decisions.

The JS thread is a single thread that does more than run your component logic — it also processes touch events and drives any JS-based animation (as opposed to animations declared with the native driver, see [animations.md](./animations.md)). This means a long synchronous operation on the JS thread — parsing a large JSON payload, running a heavy `.filter()`/`.sort()`/`.map()` chain over a big array, a tight synchronous loop — doesn't just slow down "your code," it blocks touch responsiveness and any in-flight JS-driven animation for as long as it runs, because there's no preemption; the thread finishes what it's doing before it processes the next touch event. The fixes are to break the work up (chunk it, or move it off the JS thread entirely — e.g., into a native module, a `Worklet` via Reanimated, or genuinely asynchronous native work), or to defer it with `InteractionManager.runAfterInteractions()`, which schedules a callback to run only after any current animations/transitions have finished, so, for example, a screen transition can complete smoothly before an expensive post-navigation data-processing step kicks in and competes for the same thread.

Measuring is not optional — intuition about what's slow is frequently wrong, and the fixes above have real costs (memoization overhead, virtualization tuning that trades memory for scroll smoothness) that are only worth paying where profiling shows an actual problem. Flipper (with the React DevTools and native performance plugins) and the built-in RN Performance Monitor (accessible from the in-app dev menu, showing live JS-thread and UI-thread frame rates) are the standard tools for seeing, concretely, which thread is dropping frames and roughly why, before reaching for any of the optimizations above.

## Examples

```jsx
// React.memo + useCallback: preventing every row from re-rendering when
// only one row's data actually changed.
import { memo, useCallback, useState } from 'react';
import { FlatList, View, Text, Pressable, StyleSheet } from 'react-native';

const Row = memo(function Row({ item, onToggle }) {
  console.log('rendering row', item.id); // should only log for rows that changed
  return (
    <Pressable onPress={() => onToggle(item.id)} style={styles.row}>
      <Text>{item.title}</Text>
      <Text>{item.done ? '✓' : ''}</Text>
    </Pressable>
  );
});

function TodoList({ todos, setTodos }) {
  // Stable function reference — without useCallback, a new function is
  // created every render, which would defeat Row's React.memo entirely.
  const handleToggle = useCallback((id) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }, [setTodos]);

  return (
    <FlatList
      data={todos}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <Row item={item} onToggle={handleToggle} />}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
});
```

This pattern only pays off because `Row` is memoized *and* the callback it receives is stable — without `useCallback`, `handleToggle` would be a new function identity every render of `TodoList`, so `Row`'s shallow prop comparison would always see a "changed" prop and re-render anyway, silently defeating the `memo` wrapper.

```jsx
// FlatList virtualization tuning, including getItemLayout for a fixed-height list.
import { FlatList, View, Text, StyleSheet } from 'react-native';

const ROW_HEIGHT = 72;

function ContactList({ contacts }) {
  return (
    <FlatList
      data={contacts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
        </View>
      )}
      // Fixed row height lets FlatList compute offsets without measuring —
      // required for smooth scrollToIndex and a faster initial layout pass.
      getItemLayout={(data, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={12}       // enough to fill roughly one screen
      maxToRenderPerBatch={8}       // smaller batches = smoother scroll, slower fill-in
      windowSize={5}                // fewer offscreen rows kept mounted = less memory
      removeClippedSubviews         // let Android reclaim native view memory aggressively
    />
  );
}

const styles = StyleSheet.create({
  row: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 16 },
  name: { fontSize: 16 },
});
```

Every prop here is a trade-off, not a free win: a smaller `windowSize` and `maxToRenderPerBatch` reduce memory and rendering work but increase the chance of briefly seeing blank rows during a fast fling; `getItemLayout` is only valid because every row here is exactly `ROW_HEIGHT` tall.

```js
// Deferring expensive work until after a navigation transition finishes,
// so the JS thread isn't fighting the transition animation for time.
import { InteractionManager } from 'react-native';
import { useEffect, useState } from 'react';

function useDeferredProcessedData(rawData) {
  const [processed, setProcessed] = useState(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Heavy synchronous work — runs only once animations/transitions
      // currently in flight have completed, instead of competing with them.
      const result = rawData
        .filter((item) => item.active)
        .sort((a, b) => b.score - a.score)
        .map((item) => ({ ...item, rank: computeRank(item) }));
      setProcessed(result);
    });

    return () => task.cancel();
  }, [rawData]);

  return processed;
}

function computeRank(item) {
  return Math.round(item.score * 100);
}
```

Without `runAfterInteractions`, this same synchronous `.filter().sort().map()` chain running immediately on mount would compete with an in-flight screen transition for JS-thread time, making the transition itself stutter; deferring it lets the animation finish smoothly first.

## Common Pitfalls / Gotchas

- Wrapping every component in `React.memo` "just in case" — the shallow prop comparison itself has a cost, and for components that re-render rarely or cheaply, memoization can be net-negative and adds a layer of "why isn't this updating" debugging risk when props aren't actually shallow-equal (e.g., a new object/array literal passed inline).
- Passing an inline arrow function or object literal as a prop to a `React.memo`-wrapped child (`onPress={() => doThing(item.id)}`) — this creates a new reference every render, defeating the memoization exactly as thoroughly as not memoizing at all.
- Using `getItemLayout` on a list with variable-height rows — this produces visibly wrong scroll positions and mis-measured `scrollToIndex` calls, because `getItemLayout` tells `FlatList` to trust the given offsets instead of measuring, and if rows aren't actually that height, everything after the first mismatch is off.
- Setting `windowSize` or `maxToRenderPerBatch` too low on a list with expensive row components — the intent is smoother scrolling, but overly aggressive virtualization can instead cause more visible blank flashes during fast scrolling, trading one kind of jank for another.
- Treating `removeClippedSubviews` as a safe default-on setting — it can cause rendering artifacts (disappearing content, incorrect clipping) with certain nested view hierarchies or absolutely-positioned children, so it needs actual testing on the specific list it's applied to, not blanket adoption.
- Running heavy synchronous JS (large array transforms, JSON parsing of a big payload, image manipulation math) directly in a render path or an effect that fires during a screen transition — this is a classic source of "why does navigation feel janky sometimes" bugs that `InteractionManager.runAfterInteractions` or moving the work off the JS thread entirely would fix.
- Guessing at performance problems instead of profiling with Flipper or the RN Performance Monitor first — the fixes above (memoization, virtualization tuning) all have real costs, and applying them to the wrong component wastes effort while the actual bottleneck (often something unrelated, like an unbatched state update or a heavy `useEffect`) goes unaddressed.

## Interview Questions & Answers

**Q: Why does a dropped frame matter more in React Native than in a typical web app?**
A: Mobile UIs target 60fps, giving the JS thread about 16ms per frame before a frame is dropped, and the JS thread also handles touch responsiveness and any JS-driven animation — so blocking it is immediately visible as a stutter during scrolling or gestures. On the web, a similarly-sized wasted render often goes unnoticed because there's no equivalent expectation of a continuously smooth 60fps experience for most interactions; on mobile, jank is a first-class, user-visible bug rather than a background inefficiency.

**Q: What does `getItemLayout` actually save `FlatList` from doing, and when can you not use it?**
A: Without it, `FlatList` has to measure each row's rendered size to know its position and what's currently visible, which is an async, per-row process. `getItemLayout` provides the offset, length, and index for any row directly, letting `FlatList` skip measurement entirely, compute visibility synchronously, and jump precisely to any index for `scrollToIndex`. It only works when every row has the same fixed, known-ahead-of-time height — for variable-height content like chat messages or cards with dynamic content, the offsets it reports would be wrong and produce broken scroll behavior.

**Q: What's the difference between `windowSize`, `initialNumToRender`, and `maxToRenderPerBatch`?**
A: `initialNumToRender` controls how many rows are rendered on first mount, before any scrolling happens. `maxToRenderPerBatch` caps how many additional rows are rendered per batch as the user scrolls further. `windowSize` controls the total "buffer" of mounted content kept around the visible viewport, expressed as a multiple of screen heights above and below what's currently shown. They interact: a large `windowSize` with a small `maxToRenderPerBatch` fills that buffer gradually over many small batches rather than all at once.

**Q: Why can a heavy synchronous loop freeze the UI in React Native even though rendering happens on the "UI thread"?**
A: Because touch handling and JS-driven animation logic run on the JS thread, not the native UI thread, and JS is single-threaded with no preemption — once a synchronous loop starts running, nothing else on that thread, including the handler that would process the next touch event, runs until it finishes. The native UI thread itself may still be able to draw already-committed frames, but new interactions and any animation whose per-frame values are computed in JS stall until the JS thread frees up.

**Q: What does `InteractionManager.runAfterInteractions()` actually do, and when would you reach for it over just optimizing the work itself?**
A: It schedules a callback to run after any currently-registered interactions (animations, transitions) have completed, rather than immediately. It's useful when the expensive work is unavoidable and roughly fixed-cost (you can't meaningfully make a large data transform faster), but its timing is flexible — deferring it until after a navigation transition or gesture finishes avoids visible competition for JS-thread time during the moment users are most sensitive to jank, even though the total work done is unchanged.

## Related Topics
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [hermes-engine.md](./hermes-engine.md)
- [image-and-media-handling.md](./image-and-media-handling.md)
- [animations.md](./animations.md)
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [debugging-react-native-apps.md](./debugging-react-native-apps.md)
- [../React/react-memo.md](../React/react-memo.md)
- [../React/use-memo.md](../React/use-memo.md)
- [../React/use-callback.md](../React/use-callback.md)
- [../React/react-performance-optimization.md](../React/react-performance-optimization.md)
