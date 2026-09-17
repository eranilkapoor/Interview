# App State and Lifecycle

React Native exposes the app's foreground/background status through the `AppState` module, imported from `react-native`. Unlike a component lifecycle (mount/update/unmount), `AppState` tracks the lifecycle of the *entire application process* as the OS moves it between foreground, background, and (on iOS) the brief transitional states in between. This matters because JS execution doesn't simply pause the instant a user swipes away from your app — timers, network requests, and animations can keep running for a short window (or indefinitely, if you don't clean them up), and the app can be resumed from background without a full reload, meaning your component tree and in-memory state are still alive when the user comes back.

`AppState.currentState` gives you a synchronous read of the current state at any moment, and `AppState.addEventListener('change', handler)` subscribes to transitions, calling `handler(nextAppState)` with one of three string values: `'active'` (app is in the foreground and receiving events), `'background'` (app is not visible — on Android this also covers the app being fully backgrounded; on iOS this is the state after the transitional period completes), and `'inactive'` (iOS-only — a transitional state that occurs when the app is moving between foreground and background, e.g., during a phone call interruption, the multitasking app switcher view, or a system alert taking focus, and also briefly during app launch before it becomes `active`). Android has no `'inactive'` equivalent; it only ever reports `active` or `background` (plus `extraInfo` scenarios that most apps ignore). `addEventListener` returns a `EmitterSubscription` object, and cleanup is done by calling `.remove()` on that subscription — this is important because listeners are commonly registered inside a `useEffect`, and failing to remove them on unmount leaks a listener that keeps firing (and can hold a stale closure over old props/state) for the life of the app process.

The three most common real-world use cases for `AppState` are: (1) pausing/resuming expensive work — stopping a video player, an animation loop, or a polling `setInterval` when the app backgrounds, and resuming it when the app returns to foreground, both to save battery/CPU and to avoid work happening on a screen the user can't see; (2) refreshing stale data on foreground return — re-fetching a feed, re-validating an auth token, or re-syncing state when a user switches back to the app after it's been backgrounded for a while, since the app could have been backgrounded for seconds or days and cached data may be stale; and (3) security-sensitive re-authentication — locking the app behind a biometric prompt (Face ID/Touch ID via a library like `react-native-keychain` or `expo-local-authentication`) every time the app transitions from background back to active, which is a common requirement in banking and healthcare apps where leaving the app visible/unlocked in the background app switcher is a security risk.

A related but distinct concept is the app switcher/task switcher privacy screen: many apps also listen for the transition *into* `background` (or `inactive` on iOS) to render a blurred/branded overlay before the OS takes its background-preview screenshot, preventing sensitive content (bank balances, private messages) from appearing in the OS-level app switcher thumbnail. This is a slightly different concern from pausing work, but it's implemented with the same `AppState` listener, just reacting to the opposite transition.

## Examples

```jsx
// Pausing a video/timer when backgrounded, resuming on foreground return
import { useEffect, useRef, useState } from 'react';
import { AppState, View, Text } from 'react-native';
import Video from 'react-native-video';

function BackgroundAwareVideo({ uri }) {
  const [isPaused, setIsPaused] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasActive = appState.current === 'active';
      const isNowBackground = nextAppState === 'background' || nextAppState === 'inactive';

      if (wasActive && isNowBackground) {
        setIsPaused(true); // stop playback so it doesn't keep decoding frames offscreen
      } else if (appState.current !== 'active' && nextAppState === 'active') {
        setIsPaused(false); // resume when the user comes back
      }

      appState.current = nextAppState;
    });

    // Cleanup: without this, the listener (and its closure) leaks for the app's lifetime
    return () => subscription.remove();
  }, []);

  return (
    <View>
      <Video source={{ uri }} paused={isPaused} style={{ height: 220 }} />
      <Text>{isPaused ? 'Paused (app backgrounded)' : 'Playing'}</Text>
    </View>
  );
}
```
This pattern is the most common reason to reach for `AppState`: pause anything that costs battery/CPU or that shouldn't keep running invisibly, and resume it on return. Note the ref-based tracking of the *previous* state — `nextAppState` alone only tells you where you're going, not where you came from, and both matter to detect a genuine background→active transition rather than, say, `inactive`→`background`.

```jsx
// Refreshing data when the app returns to the foreground
import { useEffect, useCallback } from 'react';
import { AppState } from 'react-native';

function useRefreshOnForeground(refetch) {
  const handleAppStateChange = useCallback(
    (nextAppState) => {
      if (nextAppState === 'active') {
        refetch();
      }
    },
    [refetch]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);
}

// Usage inside a screen component:
function FeedScreen({ feedQuery }) {
  useRefreshOnForeground(feedQuery.refetch);
  // ...render feed
}
```
Wrapping the pattern in a custom hook (`useRefreshOnForeground`) keeps the subscribe/cleanup boilerplate in one place and makes the "refetch when the user comes back" behavior reusable across screens — a very common pattern in apps backed by React Query, SWR, or Apollo, where `refetch` is already provided by the data-fetching library.

```jsx
// Locking the app behind biometric auth whenever it resumes from background
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';

function useAppLock() {
  const [isLocked, setIsLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const cameFromBackground = appState.current.match(/inactive|background/);
      if (cameFromBackground && nextAppState === 'active') {
        setIsLocked(true);
        const rnBiometrics = new ReactNativeBiometrics();
        const { success } = await rnBiometrics.simplePrompt({
          promptMessage: 'Confirm your identity',
        });
        if (success) setIsLocked(false);
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return isLocked;
}
```
This is the security-sensitive pattern: every time the app is resumed from background or the iOS `inactive` transitional state, the screen is locked until biometric auth succeeds, regardless of how long the app was backgrounded for — a common requirement in finance and health apps.

## Common Pitfalls / Gotchas

- Forgetting to call `.remove()` on the subscription returned by `addEventListener` inside a `useEffect` cleanup — this leaks the listener and, worse, keeps a stale closure alive that may reference outdated props/state or call a now-unmounted component's setters.
- Treating `'inactive'` as equivalent to `'background'` — it isn't. `'inactive'` is iOS-only and transitional (app switcher, incoming call, system alert); code that only checks `nextAppState === 'background'` will miss this state on iOS and may fail to pause things during, say, a phone call interruption.
- Relying on `AppState` alone to detect "the app was killed and relaunched" — `AppState` only tracks foreground/background transitions of a *running* process; a fully killed-and-relaunched app starts fresh with no prior `AppState` history, which is a different lifecycle event entirely (cold start, not a state transition).
- Using `AppState.currentState` at component render time expecting it to be reactive — it's a plain synchronous snapshot, not a subscribed value; reading it in JSX without a listener (or the `useAppState` hook some libraries provide) means the UI won't re-render when the state actually changes.
- Assuming Android reports the same granularity as iOS — Android generally only surfaces `active`/`background`, so logic written and tested only on iOS (relying on `inactive`) can behave differently or trigger less precisely on Android.
- Not accounting for how long the app was backgrounded — treating every foreground return identically (e.g., always showing a heavy loading spinner and re-fetching everything) ignores the common case of a brief background dip (like switching to check a notification) versus being backgrounded for hours, which often warrants different UX.

## Interview Questions & Answers

**Q: What are the possible values of `AppState`, and which one is platform-specific?**
A: The three values are `active`, `background`, and `inactive`. `inactive` is iOS-only and represents a transitional state — the app is neither fully in the foreground nor fully backgrounded, which happens during app-switcher transitions, incoming calls, or system alerts taking focus. Android only reports `active` or `background`, so code meant to run on both platforms needs to treat `inactive` as "not active" rather than ignoring it.

**Q: How do you correctly detect a "background to active" transition, and why does it matter?**
A: You need to track the *previous* state (commonly with a `useRef`, since `useRef` doesn't trigger re-renders and persists across the closure) because the `change` event only hands you the next state, not the one you're coming from. You compare the previous state (matching `background` or `inactive`) against the new `active` state to detect a genuine "returning to foreground" transition, which is what you'd hook data refreshes or re-authentication into — as opposed to firing on every single state change indiscriminately.

**Q: Why would you pause a video or a polling interval when the app backgrounds, and how do you implement it?**
A: Continuing to play video, run animations, or poll a network endpoint while the app is invisible to the user wastes battery and CPU with no visible benefit, and on iOS can even cause the OS to throttle or terminate your app's background execution unexpectedly. You implement it by subscribing to `AppState`'s `change` event, setting a `paused`/`isActive` piece of state to true when the app transitions to `background`/`inactive`, and setting it back to false when it returns to `active`, then wiring that state into the component controlling the timer or player (e.g., `<Video paused={isPaused} />`).

**Q: How would you implement "lock the app with biometrics whenever it returns from background," and what edge cases does that design need to handle?**
A: Subscribe to `AppState` changes, and whenever the previous state was `background`/`inactive` and the new state is `active`, set a `locked` flag and trigger a biometric prompt (via `react-native-biometrics`, `expo-local-authentication`, or similar), unlocking only on success. Edge cases include: not re-triggering the lock on the very first `active` state at app launch (there's no prior background state to compare against), handling a failed or canceled biometric prompt (retry vs. force logout), and deciding whether brief backgrounding (like a 2-second app-switcher glance) should still trigger a full re-lock or only trigger after some elapsed-time threshold.

**Q: Does `AppState` tell you when your app has been killed and relaunched by the OS?**
A: No — `AppState` only reports transitions of a currently running JS process between foreground and background states; it has no visibility into process termination or a subsequent cold start, since a killed app has no JS runtime left to receive events from. Detecting "was this a cold start" is a separate concern usually handled by app-level initialization logic (e.g., checking whether some in-memory flag was never set) rather than anything `AppState` exposes directly.

## Related Topics
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [app-permissions.md](./app-permissions.md)
- [async-storage.md](./async-storage.md)
- [push-notifications.md](./push-notifications.md)
- [../React/use-effect.md](../React/use-effect.md)
- [../React/use-ref.md](../React/use-ref.md)
