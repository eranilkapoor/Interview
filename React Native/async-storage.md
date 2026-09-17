# Async Storage

`@react-native-async-storage/async-storage` (the community-maintained package that replaced the module React Native itself shipped with pre-0.60) is an unencrypted, asynchronous, persistent, string-only key-value store. Every method in its API — `getItem`, `setItem`, `removeItem`, `mergeItem`, `multiGet`, `multiSet`, `multiRemove`, `getAllKeys`, `clear` — returns a Promise; there is no synchronous variant, because on both platforms the underlying storage is backed by disk I/O (SQLite on Android, a collection of flat files on iOS by default) that the library deliberately keeps off the JS thread. That async-only design is the single most important fact about the API: you cannot read a value and use it in the same render pass the way you might reach into `localStorage` synchronously on the web, so every consumer needs a loading state while the initial read resolves.

The store is strictly string-to-string. `setItem(key, value)` throws (or silently stringifies incorrectly, depending on version) if you pass anything other than a string, so storing an object or array requires `JSON.stringify` before writing and `JSON.parse` after reading, with a `try/catch` around the parse since corrupted or unexpectedly-shaped data will throw. There's no schema, no query language, no indexes, and no way to ask "give me all keys where value.age > 30" — `getAllKeys()` returns every key in the store, and if you need to filter or query you have to fetch and parse everything yourself, which is a strong signal that AsyncStorage is the wrong tool once data has any relational or query-heavy shape.

Size limits differ by platform and matter more than most people expect. On Android, AsyncStorage historically defaulted to a 6MB SQLite database cap (configurable, but easy to hit unknowingly, especially if you cache API responses or images-as-base64 in it), and writes that exceed the limit fail with an error rather than silently truncating. iOS has no such hard-coded application-level cap in the same way, but performance degrades noticeably as the number of keys and total payload size grows, because the default iOS implementation reads/writes a manifest file that scales with key count. In practice, AsyncStorage is appropriate for small amounts of data: auth tokens (though see `security-in-react-native.md` for why raw tokens shouldn't go here unencrypted), user preferences, onboarding flags, feature-flag caches, a small amount of last-known state for offline UX — not a local cache of thousands of API records or user-generated content.

Critically, AsyncStorage stores data **unencrypted in plaintext** on both platforms — on Android it's an unencrypted SQLite database file, on iOS it's unencrypted property-list-style files, and on a rooted/jailbroken device (or even a non-rooted device with physical/file-system access via backup extraction) the contents are trivially readable. This makes it unsuitable for secrets, tokens, or PII beyond what you're comfortable being exposed if the device is compromised; `react-native-keychain` (iOS Keychain / Android Keystore) is the correct tool for that class of data.

When data outgrows AsyncStorage's sweet spot, the standard escalation path is: **MMKV** (`react-native-mmkv`) for a synchronous, JSI-backed key-value store that benchmarks roughly 10-30x faster than AsyncStorage for the same operations and lets you read values synchronously at render time (no loading-state dance) — the tradeoff is it's a third-party native dependency that needs linking and (pre-0.71 or with certain RN versions) isn't usable in Expo Go without a custom dev client; **SQLite** (`expo-sqlite`, `react-native-sqlite-storage`, or `op-sqlite`) once you need actual relational queries, joins, or transactions over structured data; and **WatermelonDB** or **Realm** when you want an ORM-like layer with reactive queries, lazy loading, and sync support on top of a real embedded database, typically for offline-first apps with large, relationally-linked datasets (e.g., a chat app's messages, a note-taking app's documents).

## Examples

```jsx
// Basic read/write with JSON serialization, and the mandatory loading state
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

function useStoredPreferences() {
  const [prefs, setPrefs] = useState(null); // null = "not loaded yet"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user.preferences');
        setPrefs(raw != null ? JSON.parse(raw) : { theme: 'system', notifications: true });
      } catch (e) {
        // Corrupted JSON, storage read failure, etc. — fall back to defaults
        console.warn('Failed to load preferences, using defaults', e);
        setPrefs({ theme: 'system', notifications: true });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updatePrefs = async (next) => {
    setPrefs(next); // optimistic UI update
    await AsyncStorage.setItem('user.preferences', JSON.stringify(next));
  };

  return { prefs, loading, updatePrefs };
}
```

This shows the required pattern: values are objects in app code but must be stringified/parsed at the storage boundary, reads are async so there's always a `loading` phase, and a corrupted or missing value needs an explicit fallback rather than an assumption that `getItem` always returns valid JSON.

```js
// Batch operations: multiGet/multiSet/multiRemove avoid N sequential round-trips
import AsyncStorage from '@react-native-async-storage/async-storage';

async function cacheRecentSearches(searches) {
  // multiSet takes an array of [key, value] string pairs
  const pairs = searches.map((s, i) => [`recentSearch.${i}`, s]);
  await AsyncStorage.multiSet(pairs);
}

async function loadRecentSearches(count) {
  const keys = Array.from({ length: count }, (_, i) => `recentSearch.${i}`);
  const results = await AsyncStorage.multiGet(keys); // [[key, value], [key, value], ...]
  return results.map(([, value]) => value).filter(Boolean);
}

async function clearOldCacheKeys(prefix) {
  const allKeys = await AsyncStorage.getAllKeys();
  const staleKeys = allKeys.filter((k) => k.startsWith(prefix));
  await AsyncStorage.multiRemove(staleKeys); // one native call instead of a loop of removeItem
}
```

`multiGet`/`multiSet`/`multiRemove` batch multiple keys into a single native call, which matters because each AsyncStorage call crosses into native storage I/O — looping `await removeItem()` one key at a time is both slower and, on the old bridge architecture, a source of visible jank if the loop is long.

```jsx
// Migrating a hot, frequently-read value from AsyncStorage to MMKV for synchronous access
import { MMKV } from 'react-native-mmkv';
import AsyncStorage from '@react-native-async-storage/async-storage';

const storage = new MMKV();

async function migrateAuthTokenIfNeeded() {
  // One-time migration: pull the old async value, write it synchronously into MMKV
  const legacyToken = await AsyncStorage.getItem('auth.token');
  if (legacyToken && !storage.contains('auth.token')) {
    storage.set('auth.token', legacyToken);
    await AsyncStorage.removeItem('auth.token');
  }
}

// Elsewhere, reads are synchronous — no useEffect/loading state needed
function getCachedAuthToken() {
  return storage.getString('auth.token'); // available immediately, same tick
}
```

This illustrates the practical reason teams reach for MMKV: values read on every render or on app startup (auth tokens, feature flags, last route) benefit from synchronous access, whereas AsyncStorage forces an async round-trip and a loading state for the exact same data. (Note: for real auth tokens, prefer `react-native-keychain` over either of these — this example is about the sync-vs-async performance tradeoff, not storage security.)

## Common Pitfalls / Gotchas

- Treating `AsyncStorage.setItem` as if it accepts arbitrary values — it only accepts strings; forgetting `JSON.stringify`/`JSON.parse` either throws or silently corrupts stored data.
- Not wrapping `JSON.parse(await getItem(...))` in a `try/catch` — a missing key returns `null`, and `JSON.parse(null)` throws, as does parsing any previously-corrupted or schema-mismatched value.
- Storing auth tokens, session cookies, or PII directly in AsyncStorage — it's plaintext on disk on both platforms and readable on a compromised or rooted/jailbroken device; use `react-native-keychain` instead.
- Hitting Android's default ~6MB storage cap by caching large payloads (API responses, base64-encoded images) without realizing AsyncStorage isn't meant for bulk data storage.
- Calling `getItem`/`setItem` in a tight loop instead of `multiGet`/`multiSet`/`multiRemove` — each call is a native round-trip, and looping individually is measurably slower than batching.
- Assuming `AsyncStorage.clear()` only clears your app's own keys — it wipes the entire AsyncStorage database for the app, including keys written by third-party libraries that also use AsyncStorage internally (e.g., some analytics or persistence libraries).

## Interview Questions & Answers

**Q: Why is every AsyncStorage method asynchronous — is there no synchronous way to read a value?**
A: AsyncStorage is backed by real disk I/O (SQLite on Android, flat files on iOS), and the library deliberately keeps that I/O off the JS thread so a storage read never blocks rendering or gesture handling. There's no synchronous API in the standard package; if synchronous reads are a hard requirement (e.g., you need a value available on the very first render with no loading state), the standard answer is to migrate that specific data to MMKV, which is JSI-backed and can read/write synchronously because it doesn't cross the old async bridge boundary.

**Q: How would you store a JavaScript object in AsyncStorage, and what can go wrong?**
A: You serialize it with `JSON.stringify` before `setItem` and deserialize with `JSON.parse` after `getItem`, since the store only holds strings. What commonly goes wrong: forgetting the stringify/parse step entirely and getting `"[object Object]"` stored; not handling `getItem` returning `null` for a missing key, which makes `JSON.parse(null)` throw; and not versioning the stored shape, so an app update that changes the object's structure can leave old, incompatible cached data that silently breaks code expecting the new shape.

**Q: When would you reach for MMKV or SQLite instead of AsyncStorage?**
A: MMKV when you need synchronous reads (values needed at first render, hot-path lookups) or meaningfully better raw performance, since it's a JSI-backed native library rather than a bridge-based async API. SQLite (via `expo-sqlite` or similar) or an ORM like WatermelonDB/Realm when the data is relational, needs actual querying/filtering/joins, or is large enough that "fetch everything and filter in JS" (AsyncStorage's only query strategy) becomes a real performance problem — think a chat app's message history or an offline-first app with thousands of linked records.

**Q: Is data in AsyncStorage secure? What would you use instead for an auth token?**
A: No — AsyncStorage stores everything as plaintext on disk with no encryption on either platform, so anyone with file-system access to the device (a rooted/jailbroken device, a device backup, or physical access tooling) can read it directly. For tokens, credentials, or other secrets, the correct tool is `react-native-keychain`, which stores data in the iOS Keychain or Android Keystore — both of which provide OS-level encryption and, on supported devices, can be gated behind biometric authentication.

**Q: What's the difference between `multiGet`/`multiSet` and calling `getItem`/`setItem` in a loop?**
A: `multiGet` and `multiSet` batch several keys into a single native call and a single Promise resolution, whereas looping individual `getItem`/`setItem` calls issues one native round-trip per key. For a handful of keys the difference is negligible, but for larger batches (restoring a form's many fields, clearing dozens of cache keys) the batched methods are both faster and produce fewer intermediate renders/awaits, which is why `multiRemove` is preferred over a `for` loop of `removeItem` calls when clearing several related keys at once.

## Related Topics
- [security-in-react-native.md](./security-in-react-native.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [networking-and-api-calls.md](./networking-and-api-calls.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [../React/use-effect.md](../React/use-effect.md)
