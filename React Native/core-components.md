# Core Components

React Native ships a small set of built-in, cross-platform primitive components that map directly onto native platform views rather than HTML elements — there is no `<div>`, `<span>`, or `<p>` in React Native, because there is no DOM underneath it. `View` is the fundamental building block: a container that maps to a native `UIView` on iOS and `android.view.ViewGroup` on Android, roughly equivalent to a `<div>` but supporting only Flexbox for layout (no floats, no grid in the CSS sense, no table layout). Every other visual primitive is either a `View` under the hood or composes with one, so understanding `View`'s role as "the layout box with no intrinsic visual styling of its own" is the starting point for everything else in this folder, especially [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md).

Text is the first genuinely RN-specific gotcha for anyone coming from web: **all text content must be wrapped in a `<Text>` component** — you cannot place a raw string as a child of `<View>` the way you can drop text directly inside a `<div>` on the web. This is because native platforms don't have a generic "any element can contain text" concept the way the DOM does; text rendering, line-wrapping, and font metrics are handled by dedicated native text views (`UITextView`/`NSAttributedString` machinery on iOS, `TextView` on Android), and RN's `Text` component is the bridge to that. `Text` is also the one component where style properties like `color`, `fontSize`, and `fontWeight` *do* inherit into nested `<Text>` children (unlike `View`, where styles never cascade to children) — so `<Text style={{fontWeight: 'bold'}}>Hello <Text style={{color: 'red'}}>world</Text></Text>` nests correctly and predictably.

`Image`, `ScrollView`, `FlatList`, `SectionList`, `TextInput`, and the touchable/pressable family round out the core set. `Image` requires a `source` prop — either `{ uri: 'https://...' }` for a remote image or a `require('./local.png')` static asset reference for a bundled local image (these two forms are not interchangeable: `require` is resolved statically at bundle time, so a `uri` value can never be passed to `require`, and remote images need explicit `width`/`height` styling since RN can't know their intrinsic dimensions ahead of time without extra work), plus a `resizeMode` (`cover`, `contain`, `stretch`, `center`, `repeat`) controlling how the image fills its box. `TextInput` is RN's only native text-entry primitive and is a controlled component by convention (`value` + `onChangeText`), with props like `keyboardType` (`numeric`, `email-address`, `phone-pad`, etc.) that swap the on-screen keyboard layout, and `secureTextEntry` for password fields. `ScrollView`, `FlatList`, and `SectionList` are covered in depth in [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md); the short version is that `ScrollView` renders all of its children immediately regardless of whether they're visible, while `FlatList`/`SectionList` virtualize, rendering only what's near the viewport.

For handling taps, RN provides several overlapping APIs with a clear modern recommendation. `TouchableOpacity` and `TouchableHighlight` are the older touchable components — `TouchableOpacity` dims (`opacity`) its child on press, `TouchableHighlight` swaps to a highlight color underneath the child — and both work by wrapping a single child and rendering platform-specific touch feedback. `Pressable` is the newer, recommended API: it doesn't impose any particular visual feedback itself, but exposes granular press state (`pressed`, and optionally hover/focus on relevant platforms) via a function-as-children pattern, plus fine-grained event props (`onPressIn`, `onPressOut`, `onLongPress`) and press-area tuning (`hitSlop`, `pressRetentionOffset`) that the older Touchables don't expose as cleanly. New RN code should default to `Pressable`; the older Touchables mostly remain for legacy code and simple opacity-fade buttons.

## Examples

```jsx
// View + Text + Image: the absolute basics, including the "wrap text" rule
import { View, Text, Image, StyleSheet } from 'react-native';

function ProfileCard({ user }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: user.avatarUrl }}
        style={styles.avatar}
        resizeMode="cover"
      />
      <View style={styles.info}>
        {/* Raw strings MUST be inside <Text> — <View>Hello</View> throws */}
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.bio}>{user.bio}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  bio: { fontSize: 13, color: '#666' },
});
```

```jsx
// Controlled TextInput with keyboardType, plus Pressable with granular press state
import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';

function LoginForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        onPress={() => onSubmit({ email, password })}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? '#2563eb' : '#3b82f6' },
        ]}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

```jsx
// TouchableOpacity vs TouchableHighlight vs Pressable, side by side
import { TouchableOpacity, TouchableHighlight, Pressable, Text } from 'react-native';

function ButtonVariants({ onPress }) {
  return (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        <Text>Fades on press</Text>
      </TouchableOpacity>

      <TouchableHighlight onPress={onPress} underlayColor="#ddd">
        <Text>Highlights underneath on press</Text>
      </TouchableHighlight>

      <Pressable
        onPress={onPress}
        onLongPress={() => console.log('long pressed')}
        hitSlop={8}
      >
        {({ pressed }) => <Text>{pressed ? 'Pressing...' : 'Press me'}</Text>}
      </Pressable>
    </>
  );
}
```

## Common Pitfalls / Gotchas

- Rendering a raw string or number as a direct child of `<View>` — RN throws "Text strings must be rendered within a `<Text>` component," unlike the web where a `<div>` can contain bare text.
- Passing a `uri` object to `Image`'s `source` for a *local* asset, or a `require(...)` call for a *remote* URL — these two forms of `source` are not interchangeable; `require` paths must be static, string-literal, resolvable at bundle time.
- Forgetting that remote images (`{ uri: ... }`) have no intrinsic size RN can infer at layout time — without explicit `width`/`height` (or a flex-based layout that otherwise constrains size), the image renders as 0×0.
- Expecting `View` style properties like `color` or `fontSize` to cascade to children the way CSS inheritance works — only `Text` styles inherit into nested `Text`; `View` styles never cascade.
- Using `TouchableOpacity`/`TouchableHighlight` with more than one direct child or a child that doesn't forward refs/layout correctly — both expect a single, simple child element to apply their visual press effect to.
- Reaching for the older Touchable components by habit in new code instead of `Pressable`, missing out on `onPressIn`/`onPressOut`, `hitSlop`, and the function-as-children press-state pattern.

## Interview Questions & Answers

**Q: Why does React Native require text to be wrapped in `<Text>`, when the web lets you put text directly inside a `<div>`?**
A: There's no DOM and no generic "any element can render text" concept on native platforms — text layout, line-wrapping, and font rendering are handled by dedicated native text view classes (`UITextView`-adjacent APIs on iOS, `TextView` on Android). RN's `View` maps to a plain native container view with no built-in text-rendering capability, so any text content has to go through the `Text` component, which is the one that bridges to those native text-rendering APIs.

**Q: What's the practical difference between `TouchableOpacity`, `TouchableHighlight`, and `Pressable`?**
A: `TouchableOpacity` and `TouchableHighlight` are older, single-purpose components — one dims its child's opacity on press, the other swaps in a highlight color underneath the child — and both wrap exactly one child. `Pressable` is the modern, more flexible replacement: it doesn't prescribe any specific visual feedback, instead exposing press state (`pressed`, hover, focus) through a function-as-children render prop and finer event granularity (`onPressIn`, `onPressOut`, `onLongPress`, `hitSlop`), making it the recommended default for new code.

**Q: How do local and remote images differ when using the `Image` component?**
A: A local image is referenced with `require('./path/to/image.png')`, a static, compile-time-resolvable reference that gets bundled into the app and whose dimensions RN can determine automatically. A remote image is referenced with `source={{ uri: 'https://...' }}`, fetched over the network at runtime, and has no dimensions RN can know ahead of time — so you must explicitly size it with `width`/`height` styles or the image collapses to zero size.

**Q: Do styles cascade/inherit in React Native the way they do in CSS?**
A: Almost never — `View` and most other components have no style inheritance at all; every child must be styled explicitly. `Text` is the one deliberate exception: font-related and color styles set on a `Text` component do inherit into nested `Text` children, which is what allows patterns like bolding one word within a larger styled sentence.

**Q: When would you choose `Pressable` over the older Touchable components, and are there cases you'd still reach for `TouchableOpacity`?**
A: `Pressable` is the right default for anything needing custom or multiple press states, long-press handling, or precise touch-target tuning via `hitSlop`/`pressRetentionOffset`. `TouchableOpacity` still shows up in legacy codebases or for the simplest "fade slightly on press" button feel where its one-line built-in opacity behavior is genuinely simpler than writing the equivalent style function for `Pressable`.

## Related Topics
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [styling-in-react-native.md](./styling-in-react-native.md)
- [flexbox-layout-in-react-native.md](./flexbox-layout-in-react-native.md)
- [gesture-handling.md](./gesture-handling.md)
- [../React/controlled-vs-uncontrolled-components.md](../React/controlled-vs-uncontrolled-components.md)
- [../React/adding-styles-in-react.md](../React/adding-styles-in-react.md)
