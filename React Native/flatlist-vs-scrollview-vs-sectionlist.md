# FlatList vs ScrollView vs SectionList

Choosing between `ScrollView`, `FlatList`, and `SectionList` is one of the most common real-world React Native decisions, and it's almost entirely a question of **rendering strategy**. `ScrollView` renders every single one of its children up front, immediately, regardless of whether they're currently visible on screen — it's conceptually just a `View` that clips its content and lets you scroll through it, with no concept of "only render what's visible." That makes it perfectly fine, and even preferable, for content that is short and of a known, bounded length: a settings screen with a dozen rows, a form, a profile page with a handful of sections. But hand `ScrollView` a list of 500 or 5,000 items and it will mount, layout, and keep in memory all 500–5,000 corresponding native views simultaneously, which is both a slow initial render and a significant, unbounded memory footprint that only grows as the data grows.

`FlatList` solves this with **virtualization**: it only renders the items currently near the visible viewport (plus a configurable buffer), recycling and unmounting items as they scroll far out of view and mounting new ones as they scroll into range. This is conceptually the same idea as `RecyclerView` on Android or `UITableView`/`UICollectionView` cell reuse on iOS, exposed through a declarative, data-driven `data`/`renderItem`/`keyExtractor` API instead of imperative cell-reuse plumbing. The tuning knobs matter for interview depth and for real performance work: `initialNumToRender` controls how many items render on first mount (before any scrolling), `maxToRenderPerBatch` controls how many items render per batch as the user scrolls, `windowSize` controls how many "screens" worth of content stay rendered outside the visible area (as a multiplier, e.g. `21` means ~10 screens above and below), `removeClippedSubviews` (Android-focused, use with care) unmounts views that are clipped outside the viewport at the native level for extra memory savings, and `getItemLayout` lets you skip FlatList's dynamic measurement pass entirely by telling it the exact height/offset of every item up front — a major performance win, but only usable when every item has a fixed, known height. `onEndReached` (fired when the user scrolls within `onEndReachedThreshold` of the list's end) combined with `onEndReachedThreshold` is the standard pagination/infinite-scroll pattern, letting you fetch the next page of data just before the user hits the bottom.

`SectionList` is best understood as `FlatList` plus grouping: instead of a flat `data` array, it takes a `sections` array where each section has its own `title` and `data`, and it virtualizes across the whole thing the same way `FlatList` does, while additionally rendering a `renderSectionHeader` for each group and optionally supporting sticky section headers (`stickySectionHeadersEnabled`) that pin to the top of the viewport while their section's items scroll underneath — the classic iOS Contacts-app or grouped-settings-screen pattern. Internally, `SectionList` is built on the same virtualization machinery as `FlatList` (both ultimately sit on top of RN's `VirtualizedList`), so all the same performance knobs (`initialNumToRender`, `windowSize`, `getItemLayout`, etc.) apply, just with section-aware offsets.

The interview-relevant tradeoff to be able to articulate crisply: `ScrollView` trades memory/perf for simplicity and guaranteed-all-at-once rendering (useful when you specifically need every item measured/rendered immediately, e.g., a short form with no lazy behavior desired); `FlatList` trades a bit of API complexity and virtualization edge cases (item recycling means component instances aren't stable across scroll, keys matter enormously) for handling arbitrarily long or unknown-length lists efficiently; `SectionList` is the right choice specifically when the data is naturally grouped and you want section headers (sticky or not) rather than a flat sequence. A frequent real bug is nesting a `FlatList` inside a `ScrollView` with the same scroll direction — this defeats virtualization entirely (React Native will warn about it), since the inner `FlatList` gets told it has effectively unbounded height and ends up rendering all its items anyway.

## Examples

```jsx
// FlatList: virtualized, with pagination and fixed-height perf tuning
import { FlatList, View, Text, StyleSheet } from 'react-native';

function MessageList({ messages, onLoadMore }) {
  return (
    <FlatList
      data={messages}
      keyExtractor={(item) => item.id} // stable, unique — NOT the array index
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.author}>{item.author}</Text>
          <Text>{item.text}</Text>
        </View>
      )}
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={11}
      // Fixed row height lets FlatList skip dynamic measurement entirely
      getItemLayout={(data, index) => ({
        length: 72,
        offset: 72 * index,
        index,
      })}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5} // fire when within half a screen of the end
    />
  );
}

const styles = StyleSheet.create({
  row: { height: 72, padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  author: { fontWeight: '600' },
});
```

```jsx
// SectionList: grouped data with sticky headers
import { SectionList, View, Text, StyleSheet } from 'react-native';

function ContactList({ sections }) {
  // sections: [{ title: 'A', data: ['Alice', 'Amy'] }, { title: 'B', data: ['Bob'] }, ...]
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) => item + index}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text>{item}</Text>
        </View>
      )}
      renderSectionHeader={({ section: { title } }) => (
        <View style={styles.header}>
          <Text style={styles.headerText}>{title}</Text>
        </View>
      )}
      stickySectionHeadersEnabled
    />
  );
}

const styles = StyleSheet.create({
  item: { padding: 12 },
  header: { backgroundColor: '#f2f2f2', padding: 8 },
  headerText: { fontWeight: '700' },
});
```

```jsx
// ScrollView: fine for short, known-length content — everything renders immediately
import { ScrollView, View, Text, StyleSheet } from 'react-native';

function SettingsScreen({ options }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {options.map((opt) => (
        // Only ~10-15 items, known length — no virtualization needed here
        <View key={opt.id} style={styles.row}>
          <Text>{opt.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
});
```

## Common Pitfalls / Gotchas

- Using `ScrollView` for a long or unbounded list (search results, an infinite feed) — every item mounts immediately, causing slow initial render and unbounded memory growth as data grows.
- Nesting a `FlatList`/`SectionList` inside a `ScrollView` scrolling in the same direction — this defeats virtualization since the inner list is given effectively unbounded height, so it just renders everything anyway (RN also emits a warning about this).
- Not providing a stable, unique `keyExtractor` (or worse, using the array index) — since FlatList recycles item components as they scroll, an unstable key causes wrong items to appear to "keep" state, flicker, or re-render incorrectly. See also [../React/rendering-lists-and-keys.md](../React/rendering-lists-and-keys.md).
- Mutating the `data` array in place (e.g., `data.push(newItem)` then re-rendering with the same array reference) instead of creating a new array — `FlatList` does a reference-based check via `extraData`/prop comparison and won't detect the change, so the list silently fails to update.
- Using `getItemLayout` with variably-sized rows — it tells FlatList to trust your fixed height/offset math without measuring, so if rows actually vary in height, layout becomes visibly wrong (overlapping or gapped items).
- Setting `windowSize` or `initialNumToRender` too high "to be safe" — this defeats the point of virtualization by rendering far more offscreen content than necessary, hurting rather than helping performance.
- Forgetting `onEndReachedThreshold` tuning — too small a value can mean `onEndReached` never fires before the user visually hits the bottom (feels laggy); too large can cause it to fire repeatedly or too early.

## Interview Questions & Answers

**Q: Why would `ScrollView` become a performance problem for a 1,000-item list but not for a 10-item settings screen?**
A: `ScrollView` renders every child immediately regardless of visibility — for 10 items that's negligible, but for 1,000 items it means mounting, laying out, and holding in memory 1,000 native views simultaneously, even though only a handful are ever visible at once. `FlatList` avoids this by virtualizing: rendering only items near the viewport and recycling views as the user scrolls.

**Q: What does `getItemLayout` do, and when is it safe to use?**
A: It lets you tell `FlatList` the exact height and scroll offset of every item up front, via a pure function of index, so FlatList can skip its own dynamic measurement pass entirely — a meaningful performance win, especially for jump-to-index (`scrollToIndex`) accuracy. It's only safe when every item has a fixed, known, uniform height; for variable-height rows, providing an incorrect `getItemLayout` produces visibly broken layout (overlaps or gaps).

**Q: How does `SectionList` relate to `FlatList` under the hood?**
A: Both are built on React Native's shared `VirtualizedList` virtualization engine. `SectionList` adds a grouping layer on top — a `sections` array instead of a flat `data` array, `renderSectionHeader` for group headers, and optional sticky headers — but the same performance tuning props (`initialNumToRender`, `windowSize`, `maxToRenderPerBatch`, `getItemLayout`) apply because it's virtualizing the same way `FlatList` does underneath.

**Q: How would you implement infinite scroll / pagination with `FlatList`?**
A: Use `onEndReached`, a callback fired when the user scrolls within `onEndReachedThreshold` (a fraction of the visible list length) of the end of the content, to trigger fetching the next page and appending it to the `data` array (immutably — a new array reference). It's common to also show a loading footer via `ListFooterComponent` while the next page is in flight, and to guard against `onEndReached` firing multiple times for the same fetch with an in-flight flag.

**Q: Why is mutating the data array in place a bug with `FlatList` specifically?**
A: `FlatList` (like `React.memo`-based components generally) relies on reference/prop comparison to decide whether to re-render — if you call `.push()`/`.sort()`/`.splice()` on the same array object and pass that same reference back in as `data`, FlatList's shallow comparison sees "the same array" and may skip updating, even though its contents changed. The fix is always constructing a new array (e.g., `[...data, newItem]`) so the reference itself changes, or passing a changed `extraData` prop.

## Related Topics
- [core-components.md](./core-components.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [styling-in-react-native.md](./styling-in-react-native.md)
- [../React/rendering-lists-and-keys.md](../React/rendering-lists-and-keys.md)
- [../React/react-performance-optimization.md](../React/react-performance-optimization.md)
- [../React/keys-and-reconciliation.md](../React/keys-and-reconciliation.md)
