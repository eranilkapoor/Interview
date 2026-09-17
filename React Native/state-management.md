# State Management in React Native

The core mechanics of state management — `useState`, `useReducer`, the Context API, Redux's action/reducer/store model — are identical in React Native and React on the web, because both are the same React reconciler underneath; that fundamental material is covered in [../React/state.md](../React/state.md), [../React/use-context.md](../React/use-context.md), [../React/use-reducer.md](../React/use-reducer.md), and [../React/context-api-vs-redux.md](../React/context-api-vs-redux.md), and won't be repeated here. What's genuinely RN-specific is where those mechanics interact with mobile constraints that don't exist (or matter much less) on the web: rendering large scrollable lists at 60fps, apps being killed and relaunched by the OS, no `localStorage`, and a general pressure toward smaller JS bundles and less boilerplate on constrained mobile hardware.

The sharpest RN-specific Context API pitfall shows up at list scale. Context's fundamental behavior — every component that calls `useContext(MyContext)` re-renders whenever the context value changes, regardless of whether that component actually reads the part of the value that changed — is a known React footgun everywhere, but it becomes acutely expensive inside a `FlatList`. If a `FlatList` renders 20 visible rows and each row consumes a shared context (say, a "favorites" or "selection" context) for one boolean, updating that context to toggle a single item re-renders all 20 rows, not just the one that changed, because React can't tell from a single context value which consumers actually cared about the change. Combined with a long, fast-scrolling list where rows are being created and virtualized constantly, this compounds into visible jank. The standard fixes are to split one large context into several narrower contexts (so a change to "selected item" doesn't also re-render everyone reading "theme"), to memoize row components with `React.memo` so a context change that doesn't affect a given row's derived props doesn't force a full re-render, or to move to a state library that supports **selector-based subscriptions** — where a component subscribes to a derived slice of state and only re-renders when that specific slice changes, which Context's plain `useContext` API cannot do natively.

This selector gap is exactly why lightweight external state libraries are disproportionately popular in React Native specifically, more so than in a lot of web React work. **Zustand** and **Jotai** both let a component subscribe to a narrow slice or atom of state and skip re-rendering when unrelated state changes, without the ceremony Redux traditionally required (action types, action creators, reducers, a `Provider` wrapping the tree). On mobile, where bundle size and avoiding unnecessary re-renders both matter more directly to perceived performance (janky scrolling is immediately visible; a dropped frame is dropped), that combination of "less boilerplate" and "built-in fine-grained subscriptions" is a real, not just stylistic, advantage over reaching for Context or classic Redux by default. Redux itself remains common in larger RN codebases, especially ones sharing logic with a web app or already invested in the Redux ecosystem (middleware, DevTools, established patterns for a large team) — Redux Toolkit substantially reduces the historical boilerplate complaint — but "we defaulted to Redux for a small app" is a classic RN interview red flag for over-engineering.

The other genuinely mobile-specific concern is **persisting state across app restarts**. Unlike a website, where a tab reload is relatively rare and `localStorage` is trivially available, a mobile app is routinely killed by the OS (backgrounded and reaped for memory, or force-quit by the user) and relaunched cold, and there is no `localStorage` — persistence has to go through `AsyncStorage` or a faster native-backed engine like **MMKV**. `redux-persist` is the standard glue for Redux apps: it wraps your root reducer, serializes selected slices of the store to a storage engine on every change (debounced), and rehydrates them on app launch before the UI renders real data. The default storage engine for `redux-persist` in RN is `AsyncStorage`, but AsyncStorage is asynchronous, unencrypted-by-default, and measurably slower for frequent reads/writes than **MMKV** (a synchronous, JSI-backed key-value store originally built by WeChat), so performance-sensitive apps commonly swap in an MMKV storage adapter for `redux-persist` instead. Either way, rehydration is not instant: there's a window between app launch and the persisted state finishing its async load from disk, during which the UI either shows default/empty state or must explicitly gate rendering behind a "rehydrated" flag — get this wrong and users see a flash of an empty cart, a logged-out state, or default settings before the real persisted values pop in a moment later, a very recognizable "state flicker" bug in RN apps that don't handle rehydration timing deliberately.

## Examples

```jsx
// Context re-render problem at FlatList scale: toggling one favorite re-renders every visible row
import { createContext, useContext, useState, useCallback } from 'react';
import { FlatList, View, Text, Pressable } from 'react-native';

const FavoritesContext = createContext(null);

function Row({ item }) {
  const { favorites, toggle } = useContext(FavoritesContext);
  // Every row re-renders on ANY toggle, because the whole { favorites, toggle }
  // object is a new reference every time favorites changes — even rows whose
  // own favorited state didn't change still re-render.
  const isFav = favorites.has(item.id);
  return (
    <Pressable onPress={() => toggle(item.id)}>
      <Text>{item.title} {isFav ? '★' : '☆'}</Text>
    </Pressable>
  );
}

function FavoritesList({ items }) {
  const [favorites, setFavorites] = useState(new Set());
  const toggle = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  return (
    <FavoritesContext.Provider value={{ favorites, toggle }}>
      <FlatList data={items} renderItem={({ item }) => <Row item={item} />} keyExtractor={(i) => i.id} />
    </FavoritesContext.Provider>
  );
}
```

This is the exact failure mode described above: a `Set` (a new reference on every toggle) flows through context into every row, so React re-renders all visible rows on each toggle instead of just the one row whose favorited state actually changed.

```js
// Zustand: selector-based subscription fixes the re-render problem without Context at all
import { create } from 'zustand';

const useFavoritesStore = create((set) => ({
  favorites: new Set(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.favorites);
      next.has(id) ? next.delete(id) : next.add(id);
      return { favorites: next };
    }),
}));

function Row({ item }) {
  // Selector subscribes to ONLY this item's favorited boolean — this row only
  // re-renders when that specific derived value changes, not on every toggle.
  const isFav = useFavoritesStore((state) => state.favorites.has(item.id));
  const toggle = useFavoritesStore((state) => state.toggle);
  return (
    <Pressable onPress={() => toggle(item.id)}>
      <Text>{item.title} {isFav ? '★' : '☆'}</Text>
    </Pressable>
  );
}
```

Because Zustand's `useFavoritesStore(selector)` only re-renders a component when the selected value itself changes (via reference/shallow comparison), toggling one item no longer cascades a re-render across every row in the list — this fine-grained subscription is what plain `useContext` cannot do without manual splitting.

```js
// redux-persist with MMKV instead of AsyncStorage, plus a rehydration gate in the UI
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { MMKV } from 'react-native-mmkv';
import { PersistGate } from 'redux-persist/integration/react';
import rootReducer from './rootReducer';

const storage = new MMKV();

// redux-persist expects an async-shaped storage engine; MMKV is synchronous,
// so it's wrapped to match the interface while staying much faster than AsyncStorage.
const mmkvStorage = {
  setItem: (key, value) => { storage.set(key, value); return Promise.resolve(true); },
  getItem: (key) => Promise.resolve(storage.getString(key) ?? null),
  removeItem: (key) => { storage.delete(key); return Promise.resolve(); },
};

const persistedReducer = persistReducer(
  { key: 'root', storage: mmkvStorage, whitelist: ['cart', 'auth'] },
  rootReducer
);

export const store = configureStore({ reducer: persistedReducer });
export const persistor = persistStore(store);

// In App.js: <PersistGate loading={<SplashScreen />} persistor={persistor}>
// holds rendering of real app state behind the splash screen until rehydration
// finishes, avoiding a flash of empty/default state on cold launch.
```

`PersistGate`'s `loading` prop is the direct fix for the rehydration-flicker problem: instead of rendering the app immediately with empty default state and then popping in persisted values a moment later, the app shows a splash/loading view until `redux-persist` confirms rehydration from MMKV storage is complete.

## Common Pitfalls / Gotchas

- Wrapping a large `FlatList`'s rows in a single broad context without memoizing the context value or the row components — every context update re-renders every mounted row regardless of relevance, which is invisible in small lists and very visible (dropped frames, scroll jank) once a list is long enough to matter.
- Passing a fresh object/array literal as a context `value` on every render (e.g., `<Ctx.Provider value={{ favorites, toggle }}>` without `useMemo`) — this alone forces every consumer to re-render on every parent render, independent of whether the actual data changed.
- Reaching for Redux by default on a small-to-medium RN app "because that's what we know," incurring boilerplate and bundle-size cost the app doesn't need — this is a recurring interview red flag, and naming Zustand/Jotai as more proportionate defaults for many mobile apps shows judgment.
- Using `AsyncStorage` directly as the `redux-persist` storage engine for a large or frequently-updated store without measuring performance — its async, comparatively slow reads/writes can visibly delay rehydration or throttling-related writes on lower-end Android devices, which MMKV addresses.
- Rendering the real app UI before `redux-persist`/EAS-equivalent rehydration completes, causing a visible flash of default/empty state (empty cart, logged-out screen) before persisted values load in — needs an explicit loading gate (`PersistGate` or an equivalent manual "hasHydrated" check).
- Persisting the entire Redux store indiscriminately instead of whitelisting only the slices that actually need to survive a restart — persisting ephemeral UI state (e.g., an open modal flag) alongside real data bloats storage and can reintroduce stale UI state on next launch that should have reset.

## Interview Questions & Answers

**Q: Why does the Context API specifically become a performance problem in a long FlatList, when it might be fine elsewhere in the same app?**
A: Context re-renders every consumer on any value change, which is cheap when there are only a handful of consumers (e.g., a theme or auth context read by a few screens), but a `FlatList` can have dozens of mounted rows each calling `useContext` on the same provider. A single state change anywhere in that context — even one relevant to only one row — forces React to re-render every mounted row, and because list scrolling is already a performance-sensitive path (frames need to render in under ~16ms to stay smooth), that many unnecessary re-renders is far more likely to cause visible jank in a list than in a handful of scattered non-list consumers.

**Q: How would you fix a FlatList where every row re-renders on an unrelated context change?**
A: Three complementary approaches: split one broad context into narrower ones so a row only subscribes to the specific slice it actually needs (e.g., separate "selection" and "theme" contexts instead of one combined context); memoize the context `value` itself with `useMemo` so it doesn't produce a new object reference on every parent render; and wrap row components in `React.memo` so that even if the context re-renders the provider's subtree, a row whose actual props/derived state didn't change can bail out of re-rendering. For a genuinely large or hot list, migrating that piece of state to a selector-based store (Zustand/Jotai) is often the more durable fix, since selectors solve the granularity problem at the subscription level instead of relying on manual memoization discipline.

**Q: Why are Zustand and Jotai particularly popular in React Native compared to plain Context or classic Redux?**
A: Both offer selector-based subscriptions — a component reads only the specific slice or atom it needs and re-renders only when that slice changes — which Context's `useContext` fundamentally cannot do without manual splitting, and which classic Redux only gets via `useSelector` plus careful memoized selectors. They also require far less setup boilerplate than classic Redux (no action types/creators, no `Provider` wrapping mandatory for Zustand), which matters more on mobile where every unnecessary re-render is more visibly expensive (dropped frames during scroll/animation) and smaller, simpler state code is easier to keep performant without a dedicated state-management specialist on the team.

**Q: Walk through how you'd persist Redux state across app restarts in React Native, and what can go wrong.**
A: You wrap the root reducer with `redux-persist`'s `persistReducer`, specifying a storage engine — `AsyncStorage` by default, or an MMKV adapter for better performance — and a whitelist of which slices should actually survive a restart (auth tokens, cart contents; not transient UI flags). On app launch, `persistStore` triggers an async rehydration from that storage engine before the persisted state is available in the store. What commonly goes wrong: rendering the real UI before rehydration finishes, causing a flash of default/empty state; persisting more state than necessary, which both slows down writes and can resurrect stale UI state; and using AsyncStorage's default (unencrypted) storage for sensitive data like auth tokens without adding encryption, which is a security gap, not just a performance one.

**Q: What's the difference between rehydration "flicker" and an actual bug, and how do you prevent it?**
A: Flicker is a UX timing issue, not incorrect data — it happens because reading persisted state from disk (AsyncStorage or MMKV) is asynchronous relative to the very first render, so the app's first paint shows default/initial state (e.g., logged out, empty cart) for a brief moment before the real persisted state loads and the UI updates to reflect it. It's prevented by explicitly gating the "real" UI behind a rehydration-complete flag — `redux-persist`'s `PersistGate` component is the standard mechanism, rendering a loading/splash view until rehydration resolves — rather than letting the app render immediately with default state and silently re-render moments later once storage read completes.

## Related Topics
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [async-storage.md](./async-storage.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [../React/context-api-vs-redux.md](../React/context-api-vs-redux.md)
- [../React/use-context.md](../React/use-context.md)
- [../React/redux-store.md](../React/redux-store.md)
