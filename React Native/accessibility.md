# Accessibility

React Native exposes accessibility through a set of props that get translated into the native accessibility trees each platform already understands — `UIAccessibility` on iOS and the `AccessibilityNodeInfo`/`AccessibilityNodeProvider` system on Android. There is no separate "RN accessibility engine": every accessible prop you set on a component is forwarded, at the native-view layer, into the same APIs that power VoiceOver on iOS and TalkBack on Android. This matters because it means accessibility bugs in RN are debugged the same way native accessibility bugs are — by turning on the platform screen reader and listening to what it actually announces, not by reading your JSX and guessing.

The core prop is `accessible`, a boolean that marks a view (and everything inside it) as a single accessibility element. By default, only certain "leaf" components (`Text`, `TextInput`, `Switch`, the Touchable family) are accessible; a plain `View` wrapping several `Text` children is *not* one accessibility element by default — a screen reader will walk into it and announce each child separately. Setting `accessible={true}` on that `View` collapses it into one focusable unit, and at that point `accessibilityLabel` (the string actually spoken, which can and often should differ from the visible text), `accessibilityRole` (`button`, `link`, `header`, `image`, `search`, `adjustable`, etc. — replaces the old iOS-only `accessibilityTraits`), `accessibilityState` (`{ disabled, selected, checked, busy, expanded }`), `accessibilityHint` (a secondary string describing the *result* of interacting with the element, read after a pause), and `accessibilityValue` (`{ min, max, now, text }` for sliders, progress bars, and other range-like controls) all become meaningful on that single node.

Focus management is the part most teams get wrong. Screen readers maintain their own notion of "currently focused element," independent of DOM/JS focus concepts from the web. `AccessibilityInfo.isScreenReaderEnabled()` lets you detect at runtime whether a screen reader is active (so you can, for example, skip a purely visual animation-driven interaction and substitute an accessible alternative), and `AccessibilityInfo.setAccessibilityFocus(reactTag)` — call with a native node handle obtained via `findNodeHandle(ref.current)` — imperatively moves screen-reader focus to a specific element, which is essential after a modal opens, a route changes, or a form validation error appears, since none of those things move screen-reader focus automatically. `importantForAccessibility` (`'auto'`, `'yes'`, `'no'`, `'no-hide-descendants'`) controls whether a view and its subtree participate in the accessibility tree at all — `'no-hide-descendants'` is the correct way to hide a whole decorative subtree (like an icon made of several overlapping `View`s) from screen readers entirely, rather than relying on `accessible={false}`, which only detaches the container without hiding its children.

Live regions (`accessibilityLiveRegion` on Android: `'none'`, `'polite'`, `'assertive'`; iOS achieves the equivalent by posting `AccessibilityInfo.announceForAccessibility(message)`) let you announce dynamic content changes — a form error, a loading state, a toast — without moving focus, which is the right choice when interrupting the user's current focus position would be disruptive. Finally, touch target sizing is a WCAG-adjacent concern that's easy to overlook in RN specifically because `hitSlop` lets you expand the *tappable* area of a small visual element without changing its rendered size — Apple recommends a minimum 44×44pt target, Google recommends 48×48dp, and a common real bug is a small icon button that looks fine visually but fails both the tap-target guideline and, separately, is nearly impossible for a low-vision or motor-impaired user to hit reliably.

## Examples

```jsx
// A custom composite element collapsed into one accessible node, with role/state/hint
import { View, Text, Pressable } from 'react-native';

function FollowButton({ isFollowing, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      accessible
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow user' : 'Follow user'}
      accessibilityHint={
        isFollowing
          ? 'Removes this user from your following list'
          : 'Adds this user to your following list'
      }
      accessibilityState={{ selected: isFollowing }}
      hitSlop={12}
      style={{ padding: 8, borderRadius: 6, backgroundColor: isFollowing ? '#eee' : '#3b82f6' }}
    >
      <Text style={{ color: isFollowing ? '#111' : '#fff' }}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}
```

Without `accessible`, VoiceOver/TalkBack would walk into this `Pressable` and read only the `Text` node's literal content ("Following"/"Follow"), never announcing that it's a button, its selected state, or the hint describing what tapping it does.

```jsx
// Announcing a validation error as a live region, without stealing focus
import { useEffect, useRef } from 'react';
import { View, Text, TextInput, AccessibilityInfo, Platform } from 'react-native';

function EmailField({ error }) {
  useEffect(() => {
    if (error) {
      // iOS has no accessibilityLiveRegion equivalent prop — announceForAccessibility
      // is the cross-platform-safe way to trigger a spoken announcement on change.
      AccessibilityInfo.announceForAccessibility(error);
    }
  }, [error]);

  return (
    <View>
      <TextInput
        accessibilityLabel="Email address"
        style={{ borderWidth: 1, borderColor: error ? 'red' : '#ccc', padding: 8 }}
      />
      {error ? (
        <Text
          style={{ color: 'red' }}
          accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
```

`accessibilityLiveRegion="polite"` handles the Android case (TalkBack announces the text change without moving focus), while `AccessibilityInfo.announceForAccessibility` covers both platforms explicitly and is the more reliable cross-platform mechanism in practice.

```jsx
// Imperative focus management after a modal opens
import { useEffect, useRef } from 'react';
import { View, Text, findNodeHandle, AccessibilityInfo } from 'react-native';

function ConfirmDialog({ visible, message }) {
  const headingRef = useRef(null);

  useEffect(() => {
    if (visible && headingRef.current) {
      const tag = findNodeHandle(headingRef.current);
      if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View accessibilityViewIsModal style={{ padding: 20 }}>
      <Text ref={headingRef} accessibilityRole="header" accessible>
        {message}
      </Text>
    </View>
  );
}
```

Without this, a screen reader user who triggers the dialog gets no spoken indication anything happened — focus stays wherever it was on the screen behind the modal; `accessibilityViewIsModal` (iOS) additionally prevents VoiceOver from swiping into content behind the dialog.

## Common Pitfalls / Gotchas

- Wrapping several `Text` elements in a `View` and expecting one spoken announcement — without `accessible={true}` on the container, a screen reader announces each child separately, which usually reads as disjointed or duplicated.
- Using `accessible={false}` to hide a decorative subtree — it only detaches the *container* from the tree; children remain individually reachable. Use `importantForAccessibility="no-hide-descendants"` to actually hide an entire subtree.
- Setting `accessibilityLabel` to the same text already visually rendered inside the element *and* leaving the element `accessible`, which is usually fine, but doing the reverse — leaving off `accessibilityLabel` on an icon-only button — leaves VoiceOver/TalkBack announcing nothing useful (or the icon's file name) instead of the button's purpose.
- Assuming a route change or modal open moves screen-reader focus automatically the way a native screen transition would — RN does not do this for you; it requires an explicit `AccessibilityInfo.setAccessibilityFocus` call or, on iOS, posting a screen-changed notification.
- Sizing tap targets purely by visual/rendered size and ignoring `hitSlop` — a 24×24 icon button is both below Apple's 44pt and Google's 48dp guidance and awkward for anyone with reduced dexterity, even though it may look acceptable in a design mock.
- Testing only on one platform's screen reader — VoiceOver and TalkBack differ meaningfully in gesture model, rotor/reading-controls behavior, and how they handle `accessibilityRole`, so a component verified only with VoiceOver can still be broken for TalkBack users (and vice versa).

## Interview Questions & Answers

**Q: What does `accessible={true}` actually change on a `View` that contains multiple `Text` children?**
A: It collapses the `View` and its entire subtree into a single accessibility node. Without it, a screen reader walks into the `View` and treats each accessible child (each `Text`, in this case) as its own separately focusable element, which usually produces a fragmented reading experience. With it, the screen reader treats the whole group as one stop, and `accessibilityLabel` set on that `View` becomes the single string that gets spoken instead of whatever the children would have announced individually.

**Q: How would you hide a purely decorative element from screen readers without hiding it visually?**
A: Set `importantForAccessibility="no-hide-descendants"` on the element (or its container if it's a composite decorative subtree). This removes it and everything inside it from the accessibility tree entirely while leaving it rendered normally on screen. `accessible={false}` is not sufficient for a subtree with multiple children, since it only stops the container itself from being one accessibility stop — its children remain individually reachable.

**Q: How do you move screen-reader focus programmatically, and when is that necessary?**
A: Get a native node handle with `findNodeHandle(ref.current)`, then call `AccessibilityInfo.setAccessibilityFocus(tag)`. This is necessary whenever a UI change isn't accompanied by a natural screen-reader-detectable event — opening a modal, navigating to a new screen inside a single-page-feeling stack, or surfacing a validation error — because RN does not automatically shift screen-reader focus on state changes or navigation events the way native platform transitions typically would.

**Q: What's the difference between `accessibilityLabel` and `accessibilityHint`, and why not put everything in one?**
A: `accessibilityLabel` identifies *what* the element is ("Follow user"), and is what gets announced first and most prominently. `accessibilityHint` describes *what happens* if the user interacts with it ("Adds this user to your following list"), read after a pause, and is meant to be skippable — expert screen reader users typically configure their devices to skip hints once they've learned an app. Cramming the hint's content into the label makes every announcement longer for users who don't need the extra explanation every time.

**Q: How do live regions work in React Native, and are they handled the same way on iOS and Android?**
A: Not identically. Android has a real `accessibilityLiveRegion` prop (`'polite'` or `'assertive'`) that maps to the native `View.setAccessibilityLiveRegion` API, causing TalkBack to announce content changes without moving focus. iOS has no direct equivalent prop; the cross-platform-safe approach is calling `AccessibilityInfo.announceForAccessibility(message)` imperatively whenever the dynamic content changes, which works on both platforms and is often used even on Android in place of `accessibilityLiveRegion` for consistency.

## Related Topics
- [core-components.md](./core-components.md)
- [gesture-handling.md](./gesture-handling.md)
- [testing-react-native-apps.md](./testing-react-native-apps.md)
- [styling-in-react-native.md](./styling-in-react-native.md)
- [../React/use-ref.md](../React/use-ref.md)
- [../React/handling-events.md](../React/handling-events.md)
