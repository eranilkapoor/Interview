# Common Custom Hooks and Patterns

A large fraction of React Native app code is not screen-specific business logic but the same handful of platform-integration concerns showing up on every screen: does the keyboard currently cover this input, is the device online, has the app moved to the background. React Native exposes these as event-based, listener-style native APIs (`Keyboard.addListener`, the NetInfo subscription, `AppState.addEventListener`) rather than as reactive state, which means using them directly inside a component means manually wiring up `useEffect` + `useState` + cleanup in every place that needs them. Wrapping each one in a small custom hook — the same pattern covered generally in [../React/custom-hooks.md](../React/custom-hooks.md) — turns an imperative, listener-based API into a plain reactive value a component can just read, and centralizes the subscribe/unsubscribe lifecycle management in one tested place instead of repeating it, with its attendant risk of a forgotten cleanup and a leaked listener, across every screen that needs it.

The shape is consistent across all three: subscribe to the native event source inside a `useEffect`, store the current value in `useState`, update that state from the event callback, and return a cleanup function from the effect that removes the listener — the `useEffect` cleanup pattern is exactly what makes this safe against the classic "listener still firing after the component unmounted" bug. `useKeyboard` wraps `Keyboard.addListener('keyboardDidShow', ...)` and `keyboardDidHide` (or the `Will` variants on iOS, where the keyboard has animation lead time the `Did` events don't give you) to expose whether the keyboard is visible and how tall it currently is, which is the basis for manually adjusting layout in cases where `KeyboardAvoidingView` alone isn't enough control. A `useNetInfo`-style wrapper around `@react-native-community/netinfo` exposes connectivity state (`isConnected`, `isInternetReachable`, connection `type`) reactively instead of requiring every consumer to call `NetInfo.addEventListener` itself — worth noting that the library itself now ships a `useNetInfo` hook directly, so writing your own is mostly a teaching exercise or a place to add app-specific derived state (e.g., collapsing "connected but not reachable" into a single `isOffline` boolean). `useAppState` wraps the `AppState` API (see [app-state-and-lifecycle.md](./app-state-and-lifecycle.md) for what the state transitions themselves mean and when they fire) to expose the current state (`'active'`, `'background'`, `'inactive'`) as a reactive value rather than something you only find out about via a callback.

Beyond these platform-wrapper hooks, a second category of "common custom hook" that comes up constantly in interviews is really about composing built-in hooks to solve a recurring UI pattern: a debounced search that pairs a `TextInput` with a delayed API call so you're not firing a network request on every keystroke, a pull-to-refresh list using `FlatList`'s `refreshControl` prop together with a `RefreshControl` component and a loading boolean, and infinite scroll using `FlatList`'s `onEndReached` plus `onEndReachedThreshold` to fetch the next page before the user hits the literal bottom of the currently-loaded content. These aren't RN-specific hooks so much as they're the standard shape interviewers expect you to produce live, combining `useState`, `useEffect`/`useCallback`, and a `FlatList` prop or two — the RN-specific knowledge being tested is less "do you know a clever hook" and more "do you know which FlatList props exist for this and how they're supposed to be wired together."

## Examples

```js
// useKeyboard: tracks visibility and height reactively, wrapping the
// listener-based Keyboard API so consumers just read state.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboard() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // iOS fires "Will" events with animation lead time; Android only
    // reliably fires "Did" events, so branch on platform.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    // Cleanup is essential — an un-removed listener keeps firing into a
    // stale closure after the component that created it has unmounted.
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardVisible, keyboardHeight };
}

// Usage: nudge a "send" button up above the keyboard without relying on
// KeyboardAvoidingView's automatic (and sometimes imprecise) behavior.
function ChatComposer() {
  const { keyboardHeight } = useKeyboard();
  return (
    <View style={{ paddingBottom: keyboardHeight }}>
      {/* composer input + send button */}
    </View>
  );
}
```

This is the canonical shape every platform-wrapper hook follows: subscribe in an effect, mirror the native event into state, unsubscribe in the cleanup function.

```js
// useNetInfo and useAppState: the same wrapper pattern applied to two
// other listener-based native APIs.
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

export function useNetInfoStatus() {
  const [state, setState] = useState({ isConnected: true, isInternetReachable: true });

  useEffect(() => {
    // NetInfo.addEventListener immediately invokes the callback once with
    // the current state, then again on every subsequent change.
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isConnected: netState.isConnected,
        isInternetReachable: netState.isInternetReachable,
      });
    });
    return unsubscribe; // NetInfo's subscription returns the unsubscribe fn directly
  }, []);

  return state;
}

export function useAppState() {
  const [appState, setAppState] = useState(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  return appState;
}

// Usage: pause a video and show a banner when connectivity or foreground
// state changes, without either concern needing its own listener wiring.
function VideoScreen() {
  const { isConnected } = useNetInfoStatus();
  const appState = useAppState();
  const isForeground = appState === 'active';

  return (
    <View>
      {!isConnected && <Text>You're offline — playback paused</Text>}
      <VideoPlayer paused={!isConnected || !isForeground} />
    </View>
  );
}
```

Both hooks hide their respective native subscription API behind a plain reactive value, so `VideoScreen` never touches `NetInfo` or `AppState` directly — it just reads two booleans.

```jsx
// A common interview exercise: debounced search + FlatList, combining
// pull-to-refresh and infinite scroll (onEndReached) in one screen.
import { useState, useEffect, useCallback, useRef } from 'react';
import { View, TextInput, FlatList, Text, RefreshControl, ActivityIndicator } from 'react-native';

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer); // reset the timer on every keystroke
  }, [value, delayMs]);
  return debounced;
}

function SearchScreen({ searchApi }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 400);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestId = useRef(0);

  const fetchResults = useCallback(async (searchQuery, pageNum, append) => {
    const thisRequest = ++requestId.current;
    const data = await searchApi(searchQuery, pageNum);
    // Guard against an older, slower request resolving after a newer one.
    if (thisRequest !== requestId.current) return;
    setResults((prev) => (append ? [...prev, ...data] : data));
  }, [searchApi]);

  useEffect(() => {
    setPage(1);
    fetchResults(debouncedQuery, 1, false);
  }, [debouncedQuery, fetchResults]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchResults(debouncedQuery, 1, false);
    setRefreshing(false);
  }, [debouncedQuery, fetchResults]);

  const onEndReached = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchResults(debouncedQuery, nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, page, debouncedQuery, fetchResults]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search..."
        style={{ padding: 12, borderBottomWidth: 1, borderColor: '#ddd' }}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text style={{ padding: 12 }}>{item.title}</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5} // fetch when within half a screen of the bottom
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} /> : null}
      />
    </View>
  );
}
```

This single screen demonstrates the three most commonly asked-for RN coding patterns together: `useDebouncedValue` prevents firing a request on every keystroke, `refreshControl` + `RefreshControl` implements pull-to-refresh, and `onEndReached` + `onEndReachedThreshold` implements infinite scroll pagination, with a `requestId` ref guarding against out-of-order responses from overlapping in-flight requests.

## Common Pitfalls / Gotchas

- Forgetting to remove a `Keyboard`, `AppState`, or `NetInfo` listener in the `useEffect` cleanup function — the listener keeps firing after the component unmounts, at best wasting work and at worst calling `setState` on an unmounted component (or referencing stale closure variables).
- Using `keyboardDidShow`/`keyboardDidHide` uniformly across platforms when iOS also offers `keyboardWillShow`/`keyboardWillHide` with animation lead time — using the `Will` events on iOS gives smoother, better-timed layout adjustments, while Android generally only supports the `Did` events reliably.
- Writing a `useNetInfo` wrapper without realizing `@react-native-community/netinfo` already ships its own `useNetInfo` hook — reimplementing it is fine for learning the pattern, but production code should generally use the maintained library hook rather than a hand-rolled subscription.
- Not guarding `onEndReached` against firing multiple times in quick succession — `FlatList` can call it repeatedly as the user keeps scrolling near the threshold, and without a `loadingMore` (or similar) guard, the same next page gets requested and appended several times.
- Debouncing the API call itself but not the loading-state UI, causing a search field to flicker a spinner on/off on every keystroke — the debounce should gate when the request fires, and loading indicators should reflect the in-flight request, not every keystroke.
- Ignoring out-of-order async responses in a fast-typing search box — if request A (for "re") is slower than request B (for "react") and both are in flight, A resolving after B can overwrite B's more-relevant results unless requests are sequenced or stale responses are discarded (as with the `requestId` ref guard above).
- Setting `onEndReachedThreshold` too low (close to 0) expecting it to trigger "at the very bottom" — it's a fraction of the visible list length from the bottom, and a too-low value means the fetch often doesn't fire until the user is already looking at blank space, producing a visible pause instead of a seamless load.

## Interview Questions & Answers

**Q: Why wrap `Keyboard`, `NetInfo`, and `AppState` in custom hooks instead of using their APIs directly in components?**
A: All three are listener-based native APIs — you subscribe with a callback and must remember to unsubscribe — rather than reactive values, so using them directly means repeating the same `useEffect`-subscribe/`useState`-mirror/cleanup-unsubscribe boilerplate in every component that needs them. Wrapping each in a hook centralizes that lifecycle management once, turns an imperative subscription into a plain reactive value a component can just read, and reduces the chance of a forgotten cleanup leaking a listener in any individual screen.

**Q: Walk through what happens, step by step, if you forget to return a cleanup function from a `useEffect` that calls `Keyboard.addListener`.**
A: The listener is registered once when the effect runs, but nothing ever calls `.remove()` on it. If the component unmounts (e.g., the user navigates away), the listener is still attached to the native `Keyboard` event emitter and keeps firing its callback on every subsequent keyboard show/hide event. That callback likely calls `setState` on a component instance that no longer exists, which is wasted work at best and a warning or subtle bug at worst, and the leak compounds if the component mounts and unmounts repeatedly (e.g., a screen visited multiple times) since each mount adds another orphaned listener.

**Q: How would you implement debounced search in React Native, and why debounce on the client instead of just letting every keystroke hit the API?**
A: Track the raw input value in one piece of state, and derive a "debounced" value in a small hook that only updates after the input has been stable for some delay (e.g., 400ms), using `setTimeout` inside a `useEffect` that resets the timer on every change and clears it on cleanup. The actual search request fires off the debounced value, not the raw one. Debouncing avoids firing a network request on every single keystroke, which would be wasteful for both the client (many in-flight requests, out-of-order response risk) and the backend, and produces a UI that feels responsive to typing without hammering the API mid-word.

**Q: How does `FlatList` support infinite scroll, and what do `onEndReached` and `onEndReachedThreshold` each control?**
A: `onEndReached` is a callback `FlatList` invokes when the user scrolls near the end of the currently rendered content, which is where you'd trigger fetching and appending the next page of data. `onEndReachedThreshold` controls how close to the end triggers that callback, expressed as a fraction of the list's visible length (e.g., `0.5` fires when the user is within half a screen's worth of content from the bottom) — tuning it trades off "load too early, wasting a request if the user doesn't scroll further" against "load too late, showing a visible blank gap before new content arrives."

**Q: What's a common bug in a pull-to-refresh implementation, and how do you avoid it?**
A: A common bug is never resetting the `refreshing` state back to `false` if the refresh request fails or throws — `RefreshControl`'s spinner then stays stuck visible indefinitely, because it's driven by that boolean. The fix is to always clear the loading state in a `finally` block (or equivalent try/catch handling) around the refresh request, so the spinner stops regardless of whether the fetch succeeded or failed, and to surface the failure to the user separately rather than relying on the spinner state alone to communicate it.

## Related Topics
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [networking-and-api-calls.md](./networking-and-api-calls.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [gesture-handling.md](./gesture-handling.md)
- [../React/custom-hooks.md](../React/custom-hooks.md)
- [../React/use-effect.md](../React/use-effect.md)
- [../React/use-callback.md](../React/use-callback.md)
