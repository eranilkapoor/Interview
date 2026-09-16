# Styling in React Native

React Native has no CSS engine, no stylesheets in the web sense, and no cascade — instead, every component accepts a `style` prop that takes a plain JavaScript object (or an array of them) whose keys are a large but finite, RN-defined subset of layout and visual properties, most borrowed from CSS in spirit but written in camelCase (`backgroundColor` instead of `background-color`, `flexDirection` instead of `flex-direction`) and interpreted by RN's own native layout engine (Yoga, a C++ Flexbox implementation) rather than a browser's rendering engine. The `StyleSheet.create({...})` API is the idiomatic way to define these style objects, and while at first glance `StyleSheet.create({ card: {...} })` looks functionally identical to just writing a plain `const styles = { card: {...} }` object, it isn't purely cosmetic: `StyleSheet.create` validates each style object against RN's known style properties in development (catching typos and invalid values early), and — more importantly for performance — it can return an opaque numeric ID for each style rather than shipping the whole object across the JS-to-native boundary on every single render; the native side resolves that ID to the actual style values once, rather than the framework having to serialize and send a full style object with every re-render of every styled component.

The absence of a cascade is one of the sharpest differences from web CSS and worth stating precisely: setting `color` or `fontSize` on a `View` has zero effect on any nested `Text` inside it — style properties do not flow down through the component tree the way CSS inheritance does, with the sole, deliberate exception of `Text`, where font- and color-related styles *do* inherit into nested `Text` children (this is why `<Text style={{color: 'red'}}>Hi <Text style={{fontWeight: 'bold'}}>there</Text></Text>` renders "there" in bold red — it inherits the red from its ancestor `Text` while adding its own bold). There are also no CSS classes, no selectors, no `:hover`/`:focus` pseudo-classes in the CSS sense (though `Pressable` exposes analogous state via its render-prop API), and no specificity/cascade resolution to reason about — every component's final style is just whatever object(s) you passed to its own `style` prop, with later objects in a style array overriding earlier ones' matching keys, evaluated fresh per component.

Numbers without units are the default and represent density-independent pixels (dp on Android, points on iOS) — RN handles the underlying pixel-density scaling for you, so `width: 100` renders as a consistent physical size across devices with different pixel densities, unlike raw CSS pixels which historically needed `rem`/viewport-unit tricks to achieve the same device-independence. Flex is the default and really the *only* layout system RN supports (no floats, no CSS Grid, no table layout) — every `View` is implicitly `display: flex`, and the default `flexDirection` is `column`, the opposite of the web's default `row` for flex containers; this single difference trips up nearly everyone coming from web CSS and is covered in depth in [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md).

Platform differences show up in two main places worth knowing cold for interviews: conditional styling via `Platform.select({ ios: {...}, android: {...}, default: {...} })` (or the simpler `Platform.OS === 'ios'` check) for whenever a value genuinely needs to differ per platform, and shadows, which have no unified cross-platform API — iOS uses a family of `shadow*` properties (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) rendered via the native Core Animation shadow layer, while Android instead uses a single `elevation` property, which drives Android's Material Design elevation/shadow system and has no direct analog to iOS's finer-grained shadow controls (color, blur radius, and offset aren't independently controllable the same way). Getting a shadow to look consistent on both platforms typically means setting both sets of properties together via `Platform.select` or applying both unconditionally (iOS ignores `elevation`, Android ignores the `shadow*` properties).

## Examples

```jsx
// StyleSheet.create vs inline objects, and why validation/perf favor StyleSheet.create
import { View, Text, StyleSheet } from 'react-native';

function Card({ title }) {
  return (
    // Preferred: styles.card resolves to a stable reference/ID, validated at creation
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

// Avoid for anything reused/re-rendered often: a brand-new object literal every render
function InlineCard({ title }) {
  return (
    <View style={{ padding: 16, borderRadius: 8, backgroundColor: 'white' }}>
      <Text style={{ fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 8, backgroundColor: 'white' },
  title: { fontSize: 16, fontWeight: '600' },
});
```

```jsx
// Platform-specific overrides, including the iOS shadow* vs Android elevation split
import { View, Text, StyleSheet, Platform } from 'react-native';

function ElevatedCard({ children }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
    // Platform.OS check for a simpler, single-value difference
    marginTop: Platform.OS === 'ios' ? 12 : 8,
  },
});
```

```jsx
// No cascade except on Text: color/fontSize on View has zero effect on children
import { View, Text, StyleSheet } from 'react-native';

function Notice() {
  return (
    <View style={styles.container /* color here does NOT inherit to Text below */}>
      <Text style={styles.baseText}>
        Base text is red and italic —
        <Text style={styles.boldPart}> this part inherits red, adds bold</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { color: 'red', padding: 12 }, // has no visual effect on View itself
  baseText: { color: 'red', fontStyle: 'italic' },
  boldPart: { fontWeight: 'bold' }, // inherits color: 'red' from parent Text
});
```

## Common Pitfalls / Gotchas

- Expecting `color`/`fontSize` set on a `View` (or any non-`Text` component) to cascade down to descendant `Text` — it silently does nothing; only nested `Text`-in-`Text` inherits font/color styles.
- Writing plain inline style object literals for frequently re-rendered components instead of `StyleSheet.create` — each render creates a brand-new object, losing the reference-stability and validation benefits `StyleSheet.create` provides.
- Assuming `elevation` (Android) and the `shadow*` properties (iOS) are interchangeable or that setting one covers both platforms — they're two entirely separate shadow systems; a shadow that looks right on iOS via `shadowOpacity` will show nothing on Android unless `elevation` is also set.
- Forgetting that `flexDirection: 'column'` is RN's default (opposite of the web's `row` default) and being surprised when a `View` full of children stacks vertically instead of laying out horizontally.
- Using unitless numbers and assuming they behave like raw CSS pixels — they're density-independent pixels, which is usually what you want, but mixing assumptions from web pixel math (like exact `1px` hairlines) can produce inconsistent-looking thin borders across devices.
- Trying to use CSS class names, cascading selectors, or `:hover`/`:active` pseudo-selectors — none of these exist in RN's styling model; interactive states must be handled via component state or `Pressable`'s render-prop pattern.

## Interview Questions & Answers

**Q: What does `StyleSheet.create` actually buy you over a plain JavaScript style object?**
A: Two things: development-time validation of style keys/values (catching typos and invalid properties early), and a performance benefit — it can return a stable, opaque style reference/ID rather than a fresh object needing to be serialized and passed across the JS-to-native bridge on every render, since the native side can resolve the ID to actual values once rather than repeatedly.

**Q: How does styling inheritance in React Native differ from CSS's cascade?**
A: React Native has essentially no cascade — a style set on a parent `View` never automatically applies to its children. The one deliberate exception is `Text`: font- and color-related styles set on a `Text` component do inherit into nested `Text` children, which is what lets you style a whole sentence and then override just a substring's weight or color within it.

**Q: What's the default `flexDirection` in React Native, and why does this trip people up coming from web CSS?**
A: `column`, meaning children stack vertically by default — the opposite of the web's flex default of `row`. Developers coming from web CSS who expect children to lay out side-by-side by default are often confused when a `View` full of siblings stacks vertically instead, until they explicitly set `flexDirection: 'row'`.

**Q: How do you handle shadows in a cross-platform way in React Native?**
A: iOS and Android use two unrelated shadow systems — iOS reads a family of `shadow*` properties (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) and ignores `elevation`; Android reads a single `elevation` property (driving its Material Design elevation shadow) and ignores the `shadow*` properties. The common approach is setting both, typically via `Platform.select`, so each platform picks up the styling meant for it.

**Q: What do unitless numeric style values (like `width: 100`) represent in React Native?**
A: Density-independent pixels — RN accounts for the device's actual pixel density under the hood, so a `width: 100` view renders at a consistent physical size across devices with different screen densities, without the author needing to do any pixel-ratio math themselves.

## Related Topics
- [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md)
- [core-components.md](./core-components.md)
- [responsive-design-and-screen-sizes.md](./responsive-design-and-screen-sizes.md)
- [performance-optimization.md](./performance-optimization.md)
- [platform-specific-code.md](./platform-specific-code.md)
- [../React/adding-styles-in-react.md](../React/adding-styles-in-react.md)
