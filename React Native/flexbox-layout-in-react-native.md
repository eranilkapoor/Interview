# Flexbox Layout in React Native

Flexbox is not just React Native's preferred layout system — it's the *only* layout system available, with no floats, no CSS Grid, and no table layout to fall back on, which makes fluency with it non-negotiable in a way it isn't quite on the web (where flexbox is one of several tools). Under the hood, RN uses Yoga, a cross-platform C++ implementation of Flexbox, which implements the same core concepts as CSS Flexbox — `flexDirection`, `justifyContent`, `alignItems`, `alignSelf`, `flexGrow`/`flexShrink`/`flexBasis` — but with a few default values deliberately flipped from web CSS, and it's these defaults, more than any conceptual difference, that catch developers off guard when moving between the two.

The single biggest default difference: RN's `flexDirection` defaults to `column`, while the web's flexbox default is `row`. This means an untouched `View` containing several `View`/`Text` children stacks them vertically by default in RN, whereas the equivalent unstyled flex container on the web lays children out horizontally. Every other flex property keeps its conceptual meaning but now operates along whichever axis `flexDirection` establishes: `justifyContent` aligns children along the *main* axis (vertically, by default, in RN, since the main axis is column), while `alignItems` aligns children along the *cross* axis (horizontally, by default). `alignSelf` overrides `alignItems` for one individual child rather than the whole container. `flex: 1` tells a child to grow and consume all available remaining space along the main axis relative to its siblings — it's shorthand primarily for `flexGrow: 1` (with `flexShrink` and `flexBasis` defaults filled in), and giving multiple siblings `flex: 1` divides the remaining space evenly between them, a very common pattern for equal-width/height panes.

`flexGrow`, `flexShrink`, and `flexBasis` are the three granular properties `flex` is shorthand for, and knowing them individually matters for anything beyond the simplest layouts: `flexGrow` (default `0`) controls how much of the *extra* available space a child should absorb relative to siblings; `flexShrink` (default `0` in RN, notably *different* from the web's default of `1`) controls whether/how much a child is allowed to shrink below its base size when there isn't enough room; `flexBasis` sets a child's starting size along the main axis before growing/shrinking is applied, similar to `width`/`height` but axis-aware. This `flexShrink` default difference is a subtle but real RN-vs-web gotcha: content that would automatically shrink to fit on the web may instead overflow its container in RN unless `flexShrink: 1` is set explicitly.

Dimensions in RN can be expressed as unitless numbers (density-independent points, absolute) or as percentage strings (`width: '50%'`), which resolve relative to the parent's resolved size along that axis, just like CSS percentages — useful for building things like a fixed two-column split without needing `flex` at all. Modern React Native (0.71+) also supports the `gap`, `rowGap`, and `columnGap` style properties directly on flex containers, giving even spacing between children without manually adding margin to every child except the last (the classic pre-`gap` workaround). One layout gotcha worth flagging explicitly: unlike some mental models of flexbox, RN's flex children do **not** wrap by default (`flexWrap` defaults to `nowrap`) — a `row` of children wider than their container will overflow or get squeezed by `flexShrink`, not automatically wrap to a new line, unless `flexWrap: 'wrap'` is set.

## Examples

```jsx
// A header row: flexDirection row, space-between, centered vertically
import { View, Text, StyleSheet } from 'react-native';

function Header({ title, onBack }) {
  return (
    <View style={styles.header}>
      <Text onPress={onBack}>{'< Back'}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={{ width: 40 }} /> {/* spacer to balance the back button width */}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',       // RN default is 'column' — must opt into row explicitly
    justifyContent: 'space-between', // spread along the main (horizontal) axis
    alignItems: 'center',       // center along the cross (vertical) axis
    padding: 16,
  },
  title: { fontSize: 18, fontWeight: '600' },
});
```

```jsx
// A centered card: column layout, flex:1 to fill, centered content
import { View, Text, StyleSheet } from 'react-native';

function CenteredCard() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text>I'm centered both ways</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,                 // fill the whole available screen space
    justifyContent: 'center', // center along main axis (vertical, column default)
    alignItems: 'center',     // center along cross axis (horizontal)
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: 'white',
  },
});
```

```jsx
// A two-column grid: flexWrap + percentage widths + gap
import { View, Text, StyleSheet } from 'react-native';

function ProductGrid({ products }) {
  return (
    <View style={styles.grid}>
      {products.map((p) => (
        <View key={p.id} style={styles.tile}>
          <Text>{p.name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',   // without this, a row of many children overflows instead of wrapping
    gap: 12,            // even spacing between tiles, RN 0.71+
    padding: 12,
  },
  tile: {
    width: '47%',       // two columns, accounting for the gap
    aspectRatio: 1,
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    padding: 8,
  },
});
```

## Common Pitfalls / Gotchas

- Forgetting RN's `flexDirection` default is `column`, not `row` — expecting siblings to lay out horizontally by default (as on web) when they actually stack vertically.
- Confusing `justifyContent` (main-axis alignment) with `alignItems`/`alignSelf` (cross-axis alignment) — which axis is "main" flips depending on `flexDirection`, so the same property name aligns differently depending on context.
- Assuming content shrinks to fit automatically the way it often does on the web — RN's `flexShrink` defaults to `0` (vs. the web's `1`), so overflowing content needs `flexShrink: 1` set explicitly or it will overflow its container.
- Expecting `flexWrap: 'wrap'` by default — RN flex containers default to `nowrap`, so a `row` of children wider than the container overflows/squeezes rather than wrapping onto new lines unless wrap is explicitly enabled.
- Mixing `flex: 1` and a fixed `width`/`height` on the same axis without understanding precedence — an explicit `width` combined with `flexBasis`/`flex` behavior can produce layouts that don't match intuition; it's usually clearer to pick one sizing strategy per axis.
- Using percentage-based dimensions inside a parent whose own size is undetermined (e.g., a parent with no explicit height and no `flex: 1` up the chain to the screen) — percentages resolve against the parent's *resolved* size, so an ambiguously-sized parent can collapse children to 0.

## Interview Questions & Answers

**Q: What is the single biggest default difference between Flexbox on the web and Flexbox in React Native?**
A: `flexDirection` defaults to `column` in React Native, versus `row` on the web. This means an unstyled `View` containing multiple children stacks them vertically by default in RN, while the equivalent web flex container lays them out horizontally by default — a very common source of "why isn't this laying out side by side" confusion for developers coming from web CSS.

**Q: Explain `flex: 1` — what is it shorthand for, and what happens if you give three sibling views `flex: 1` each?**
A: `flex: 1` is primarily shorthand for `flexGrow: 1` (with `flexShrink`/`flexBasis` defaults applied), telling a child to grow and consume available remaining space along the main axis. Giving three siblings `flex: 1` each divides the parent's remaining main-axis space evenly among all three, a common pattern for equal-width columns or equal-height rows.

**Q: How does RN's default `flexShrink` value differ from the web's, and why does it matter?**
A: RN defaults `flexShrink` to `0`, while the web defaults it to `1`. On the web, content that doesn't fit will shrink to accommodate its container by default; in RN it won't — content can overflow its parent unless `flexShrink: 1` is set explicitly on the overflowing child, which is a real, easy-to-hit layout bug when porting mental models from web CSS.

**Q: How would you build a two-column grid layout in React Native?**
A: Set the container's `flexDirection: 'row'` and `flexWrap: 'wrap'` (wrapping isn't the default), then give each item a percentage-based `width` just under half (e.g., `47%`) to leave room for spacing, or use the `gap` style property (RN 0.71+) on the container instead of manually managing margins between items to get even spacing without doing that math per item.

**Q: What's the difference between `alignItems` and `alignSelf`?**
A: `alignItems` is set on the flex *container* and controls cross-axis alignment for all of its children at once. `alignSelf` is set on an individual *child* and overrides whatever `alignItems` value the parent specified, letting one specific child align differently from its siblings along the cross axis.

## Related Topics
- [styling-in-react-native.md](./styling-in-react-native.md)
- [core-components.md](./core-components.md)
- [responsive-design-and-screen-sizes.md](./responsive-design-and-screen-sizes.md)
- [../React/adding-styles-in-react.md](../React/adding-styles-in-react.md)
