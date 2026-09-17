# Forms and Validation

React Native has no `<form>` element, no `<input type="email">`, no `required` attribute, and no browser-native validation UI — there is nothing analogous to the HTML form submission model where pressing Enter in the last field or clicking a `type="submit"` button triggers a `submit` event the browser itself understands. Every "form" in React Native is just a tree of `TextInput`, `Switch`, `Picker`, and similar controlled components wired together entirely in application code: you own the state, you own validation, you own what "submitting" even means, and you own moving focus between fields. This is the single biggest mental adjustment for developers coming from web forms.

`TextInput` is normally used as a controlled component: `value` holds the current string in React state and `onChangeText` (not `onChange` — RN's event doesn't hand you a synthetic event object with `target.value`, it hands you the new string directly as the callback argument) updates that state on every keystroke. `keyboardType` (`default`, `numeric`, `email-address`, `phone-pad`, `decimal-pad`, ...) swaps the on-screen keyboard layout to match the expected input, and `returnKeyType` (`next`, `done`, `search`, `send`, ...) changes the label of the keyboard's return key — but changing the label doesn't change its behavior; you still have to wire `onSubmitEditing` yourself to actually do something when it's pressed. A common pattern is ref-chaining between fields: each `TextInput` gets a `ref`, and each field's `onSubmitEditing` calls `.focus()` on the *next* field's ref, simulating the "Tab between fields" experience the web gets for free, with the last field's `onSubmitEditing` triggering the actual form submission instead.

Keyboard handling is its own category of problems, because the on-screen keyboard is an overlay that can cover the very input the user is typing into, and RN does not reflow layout to avoid it automatically. `KeyboardAvoidingView` is the built-in tool, but its `behavior` prop genuinely needs different values per platform: `'padding'` works well on iOS (it pads the bottom of the view to lift content above the keyboard), while `'height'` (or omitting `behavior` and doing nothing) tends to work better on Android, since Android often already resizes the window via the `windowSoftInputMode` manifest setting, and combining `KeyboardAvoidingView` with an OS-level resize can double-compensate and produce a visibly wrong layout. `keyboardVerticalOffset` is frequently needed to account for a header/nav bar's height that `KeyboardAvoidingView` can't see on its own. For scrollable forms, plain `ScrollView` does not auto-scroll to keep a focused input visible above the keyboard — this is what third-party libraries like `react-native-keyboard-aware-scroll-view` (`KeyboardAwareScrollView`) or newer built-ins in `react-native-keyboard-controller` solve, by measuring the focused input's position and programmatically scrolling it into view.

For validation logic, most non-trivial RN forms reach for the same libraries used on the web: `react-hook-form` is the most common choice because it's largely UI-agnostic — its `Controller` component bridges its internal (uncontrolled-by-default, ref-based) model to RN's `TextInput`, which doesn't expose the DOM-style ref API `react-hook-form`'s native `register` expects. Formik is the older alternative, using a fully controlled `values`/`handleChange`/`handleBlur` model that maps a bit more directly onto RN's `value`/`onChangeText` pattern but re-renders more aggressively. Schema validation libraries — `zod` and `yup` being the two most common — are typically paired with `react-hook-form` via a resolver (`@hookform/resolvers/zod`), letting you define the validation rules once, as a schema, and have both the error messages and the TypeScript types derived from it.

## Examples

```jsx
// Manual controlled form with ref-chaining and onSubmitEditing
import { useRef, useState } from 'react';
import { View, TextInput, Pressable, Text } from 'react-native';

function SignUpForm({ onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef(null);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        // Without this, pressing "next" on the keyboard does nothing —
        // RN never moves focus between fields automatically.
        blurOnSubmit={false}
      />
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        returnKeyType="done"
        onSubmitEditing={() => onSubmit({ email, password })}
      />
      <Pressable onPress={() => onSubmit({ email, password })} style={{ padding: 12 }}>
        <Text>Create account</Text>
      </Pressable>
    </View>
  );
}
```

`blurOnSubmit={false}` on the email field stops the keyboard from dismissing before focus shifts to the password field; without it, iOS in particular can briefly close and reopen the keyboard, causing a visible flicker.

```jsx
// KeyboardAvoidingView with platform-specific behavior and offset
import { KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';

function MessageComposer({ headerHeight }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
        <TextInput
          multiline
          placeholder="Write a message..."
          style={{ minHeight: 100, borderWidth: 1, borderColor: '#ccc', padding: 8 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

`keyboardShouldPersistTaps="handled"` is required whenever a `ScrollView` contains tappable elements (like a "Send" button) near a focused `TextInput` — without it, the first tap outside the input just dismisses the keyboard instead of registering as a press on the button.

```jsx
// react-hook-form + zod schema validation, wrapped around TextInput via Controller
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { View, TextInput, Text, Pressable } from 'react-native';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  age: z.coerce.number().min(18, 'Must be 18 or older'),
});

function ProfileForm({ onSubmit }) {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', age: '' },
  });

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ borderWidth: 1, padding: 8 }}
          />
        )}
      />
      {errors.email && <Text style={{ color: 'red' }}>{errors.email.message}</Text>}

      <Pressable onPress={handleSubmit(onSubmit)} style={{ padding: 12 }}>
        <Text>Save</Text>
      </Pressable>
    </View>
  );
}
```

`Controller` exists because `react-hook-form`'s default `register` API assumes a DOM-style ref it can attach event listeners to directly, which `TextInput` doesn't support; `Controller` instead hands you `onChange`/`onBlur`/`value` to wire manually onto RN's controlled-component props.

## Common Pitfalls / Gotchas

- Expecting a "submit on Enter" behavior for free — there's no `<form onSubmit>` equivalent; you must wire `onSubmitEditing` on the last field (or a submit button's `onPress`) explicitly, and `returnKeyType` only changes the key's *label*, not its behavior.
- Using the same `KeyboardAvoidingView` `behavior` value on both platforms — `'padding'` on Android often produces incorrect extra spacing because Android's window can already resize for the keyboard depending on `windowSoftInputMode`; `behavior` genuinely needs to differ per platform in most apps.
- Wrapping a focusable input in a plain `ScrollView` and assuming it will scroll into view above the keyboard automatically — it won't; that requires `KeyboardAwareScrollView`, `react-native-keyboard-controller`, or manual `scrollTo` calls based on measured input position.
- Forgetting `keyboardShouldPersistTaps="handled"` (or `"always"`) on a `ScrollView` containing both a focused `TextInput` and a nearby button — the button's first tap gets swallowed as a "dismiss keyboard" gesture instead of a press.
- Passing `defaultValue` instead of `value` (or mixing the two) on a `TextInput` you intend to be controlled — unlike some web form libraries, RN's `TextInput` treats these as genuinely different modes, and mixing controlled and uncontrolled patterns on the same input produces stale or unresponsive text.
- Reaching for `register()`-style APIs from `react-hook-form` without realizing RN needs `Controller` instead, because `TextInput` doesn't expose a DOM-compatible ref that `register` can attach native event listeners to.

## Interview Questions & Answers

**Q: Why doesn't React Native have anything like an HTML `<form>` element, and what does that mean practically?**
A: There's no DOM, no browser, and no native concept of a form-submission event on either iOS or Android UI toolkits that RN could map a `<form>` onto. Practically, it means there's no free "submit on Enter," no built-in `required`/`pattern` validation, and no native submission event — every piece of that behavior (collecting field values, validating them, deciding what counts as a submit action) has to be implemented in application code, typically via controlled `TextInput`s plus an explicit `onSubmitEditing`/button-press handler.

**Q: What's the difference in how `KeyboardAvoidingView`'s `behavior` prop should be set on iOS versus Android, and why?**
A: On iOS, `'padding'` is typically correct — it adds bottom padding to lift content above the keyboard, since iOS does no automatic window resizing on its own. On Android, `'height'` (or often no `KeyboardAvoidingView` at all) tends to work better, because Android's `windowSoftInputMode` can already resize the app window when the keyboard appears; layering `KeyboardAvoidingView`'s own adjustment on top of that OS-level resize can double-compensate and push content further than intended.

**Q: Why does `react-hook-form` need a `Controller` component for React Native inputs instead of using `register` directly like on the web?**
A: `register` is built around attaching native DOM event listeners to a ref pointing at an actual `<input>` element, which is how `react-hook-form` avoids re-rendering on every keystroke on the web. RN's `TextInput` doesn't expose that kind of DOM-compatible ref or native event-listener API, so there's no way for `register` to hook in directly. `Controller` instead renders your field and manually wires `value`, `onChange`, and `onBlur` as props into whatever input component you give it, which works with any controlled RN component.

**Q: How would you validate a form's fields against a schema, and why pair `zod` (or `yup`) with `react-hook-form` rather than writing validation by hand?**
A: You define the shape and constraints once as a schema (e.g., `z.object({ email: z.string().email(), age: z.coerce.number().min(18) })`), then pass it to `react-hook-form` via a resolver (`zodResolver(schema)`). This centralizes validation rules in one declarative place instead of scattering imperative `if` checks across change handlers, produces consistent error messages, and — in TypeScript — lets you derive the form's type directly from the schema (`z.infer<typeof schema>`) so the validation rules and the type system can't drift apart.

**Q: A user reports that tapping a "Send" button right after typing in a chat input does nothing on the first tap. What's the likely cause?**
A: The input is almost certainly inside a `ScrollView` (directly or via a `FlatList`/`SectionList`) without `keyboardShouldPersistTaps` set to `"handled"` or `"always"`. By default, a `ScrollView` treats a tap outside the currently focused input as a request to dismiss the keyboard and swallows that tap rather than forwarding it to the button underneath — so the first tap just closes the keyboard, and the second tap is the one that actually presses the button.

## Related Topics
- [core-components.md](./core-components.md)
- [navigation.md](./navigation.md)
- [gesture-handling.md](./gesture-handling.md)
- [accessibility.md](./accessibility.md)
- [../React/controlled-vs-uncontrolled-components.md](../React/controlled-vs-uncontrolled-components.md)
- [../React/use-ref.md](../React/use-ref.md)
