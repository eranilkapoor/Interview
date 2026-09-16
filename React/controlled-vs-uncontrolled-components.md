# Controlled vs Uncontrolled Components

Form elements like `<input>`, `<textarea>`, and `<select>` naturally maintain their own internal state in the DOM — you type into an `<input>` and the browser just remembers what you typed, independent of any JavaScript framework. React gives you two fundamentally different ways to work with that internal state, and the distinction between them is one of the most practically important patterns in everyday React form-building. A **controlled component** is one where React's state is the single source of truth for the input's value: you pass `value` (bound to a piece of state) and `onChange` (which updates that state) to the input, so every keystroke flows through React first, and the DOM element simply *reflects* whatever the state currently says. An **uncontrolled component**, by contrast, lets the DOM manage its own value internally as it normally would, and React only reaches in to read that value on demand — typically via a `ref` — rather than tracking every change through state.

Controlled components are the more "React-idiomatic" default because they keep the UI, the underlying data, and any derived logic (validation, conditional enabling/disabling, formatting) perfectly in sync at all times — since the input's displayed value can never drift from what your state says it should be, and you can transform, validate, or reject input on every keystroke by controlling what you write back into state. The tradeoff is a bit more boilerplate (a state variable and an `onChange` handler per field) and, in very large or rapidly-typing forms, a re-render on every keystroke — usually irrelevant in practice, but worth knowing about.

Uncontrolled components trade that fine-grained control for simplicity: you set an initial value with `defaultValue` (not `value`, which would make it controlled) and only read the current value when you actually need it — typically on form submission, via `inputRef.current.value`. This avoids a state update (and re-render) on every keystroke and is often the pragmatic choice for simple forms, for integrating with non-React code/libraries that already manage the DOM directly, or for a case React can't meaningfully control at all: file inputs. A `<input type="file">`'s value is inherently DOM-managed (for security reasons the browser won't let JavaScript set it programmatically), so file inputs are effectively always uncontrolled — you read `inputRef.current.files` via a ref rather than trying to drive the field's value from state.

In practice, most real-world forms lean controlled for fields that need validation, conditional UI, or formatting-as-you-type, and lean uncontrolled for simple "just grab the value when the form submits" cases or DOM-only concerns like file uploads. React also warns loudly in the console if you accidentally flip a field from controlled to uncontrolled (or back) across renders — usually by passing `value={undefined}` on some code path — because doing so mid-lifecycle is a common source of subtle bugs, so it's worth picking one approach per field and sticking with it consistently.

## Examples

```jsx
// Controlled: React state is the single source of truth for the input's value
function ControlledForm() {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting:', name); // state already holds the current value
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.toUpperCase())} // transform on every keystroke
      />
      <button disabled={name.trim() === ''}>Submit</button>
    </form>
  );
}
```

```jsx
// Uncontrolled: the DOM manages the value; React only reads it via a ref on submit
function UncontrolledForm() {
  const nameRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitting:', nameRef.current.value); // read on demand, not on every keystroke
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={nameRef} defaultValue="" />
      <button>Submit</button>
    </form>
  );
}
```

```jsx
// File inputs are always uncontrolled — the browser won't let value be set programmatically
function FileUploader() {
  const fileInputRef = useRef(null);

  const handleUpload = () => {
    const file = fileInputRef.current.files[0];
    if (file) console.log('Selected file:', file.name, file.size);
  };

  return (
    <div>
      <input type="file" ref={fileInputRef} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Flipping a field between controlled and uncontrolled across renders (e.g., `value={someVariable}` where `someVariable` is sometimes `undefined`) — React warns about this because it silently changes how the input behaves mid-lifecycle.
- Setting both `value` and `defaultValue` on the same input — this is contradictory; `value` alone (plus `onChange`) makes it controlled, `defaultValue` alone makes it uncontrolled.
- Forgetting `onChange` on a controlled input — without it, React will make the field read-only (since nothing ever updates the state driving `value`) and log a console warning.
- Trying to set a file input's `value` from state — the browser disallows this for security reasons, so file inputs must be read via `ref`, not driven by `value`.
- Overusing controlled inputs for every field in a very large form when the app only ever needs the final values on submit — this adds unnecessary re-renders per keystroke; an uncontrolled form (or a form library that batches this internally) can be a better fit there.

## Interview Questions & Answers

**Q: What's the core difference between a controlled and an uncontrolled component?**
A: In a controlled component, React state is the single source of truth for the input's value — you pass `value` and update it via `onChange`, and the DOM element only reflects that state. In an uncontrolled component, the DOM manages the value itself; React sets an initial value with `defaultValue` and only reads the current value on demand through a `ref`, rather than tracking every change in state.

**Q: Why would you choose an uncontrolled input over a controlled one?**
A: Uncontrolled inputs avoid a state update (and re-render) on every keystroke, require less boilerplate for simple "read it on submit" forms, and are necessary for cases the DOM inherently manages, like file inputs, where the browser won't allow React (or any JavaScript) to set the value programmatically for security reasons.

**Q: How do you get the current value of an uncontrolled input in React?**
A: Attach a `ref` to the input (`useRef(null)` and `ref={inputRef}`), then read `inputRef.current.value` (or `.files` for a file input) whenever you need it — typically in a submit handler — rather than tracking the value in state via `onChange`.

**Q: What happens if you pass `value` to an input but forget the `onChange` handler?**
A: The input becomes effectively read-only: React will render whatever the `value` prop says, but since nothing updates the underlying state in response to user input, the displayed value never changes as the user types. React also logs a console warning telling you to either provide `onChange` or explicitly mark the field read-only.

**Q: Why can't file inputs be controlled the way text inputs can?**
A: The value of a file input represents a reference to a file on the user's local filesystem, and browsers refuse to let JavaScript set that value programmatically as a security measure (to prevent a malicious script from silently "uploading" an arbitrary local file). Because React can't drive `value` for a file input, it's inherently uncontrolled — you read the selected file(s) via `inputRef.current.files` instead.

## Related Topics
- [use-ref.md](./use-ref.md)
- [refs-and-forward-ref.md](./refs-and-forward-ref.md)
- [handling-events.md](./handling-events.md)
- [use-state.md](./use-state.md)
- [state.md](./state.md)
