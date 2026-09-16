# Components

A React application is built out of components — self-contained pieces of UI that each own their own logic and appearance. A component can be as small as a single button or as large as an entire page; the point is that each one is a well-defined, independently understandable unit that you can build, test, and reuse on its own, then combine with others to build up progressively larger pieces of an interface. Modern React components are, at their core, just JavaScript functions that return markup describing what should appear on screen — there's no separate "component class" you're required to define or special registration step; a function that returns JSX *is* a component.

```js
function MyButton() {
  return (
    <button>I'm a button</button>
  );
}
```

That's a complete, valid component. The function's body describes the markup to render (`<button>I'm a button</button>`), and React knows how to take this function and produce real DOM from it. What makes this genuinely useful is composition: once you've declared `MyButton`, you can nest it inside another component exactly the way you'd nest any other JSX element, and React will render it in place:

```js
export default function MyApp() {
  return (
    <div>
      <h1>Welcome to my app</h1>
      <MyButton />
    </div>
  );
}
```

Here, `MyApp` is itself a component that composes a native HTML element (`<div>`, `<h1>`) with a custom component (`<MyButton />`). This is the fundamental building block of every React application: small components nest inside larger ones, forming a tree, all the way up to a single root component that gets rendered into the page.

One rule is non-negotiable and trips up nearly everyone at first: component names must start with a capital letter. This isn't a stylistic convention — it's how React (and the JSX compiler) distinguishes between the two fundamentally different things a JSX tag can refer to. A lowercase tag like `<button>` or `<div>` is treated as a built-in, native DOM element and passed straight through as a string to the underlying rendering call. A capitalized tag like `<MyButton />` is treated as a reference to a variable in scope — specifically, a component function — and compiled into a call that *invokes* that function to determine what should render. If you name a component with a lowercase first letter, React (or the JSX compiler) will not throw a helpful error; it will simply try to render it as if it were an unknown native HTML tag, which is a confusing bug to track down. This convention is also why props destructured from HTML-standard names sometimes need renaming and why libraries and codebases enforce capitalized component names via linting.

## Examples

```jsx
// A minimal function component
function MyButton() {
  return <button>I'm a button</button>;
}

// Composing it into a parent component
export default function MyApp() {
  return (
    <div>
      <h1>Welcome to my app</h1>
      <MyButton />
    </div>
  );
}
```

```jsx
// Components accept props (inputs) and can be reused with different data
function Greeting({ name }) {
  return <p>Hello, {name}!</p>;
}

export default function App() {
  return (
    <div>
      <Greeting name="Anil" />
      <Greeting name="Priya" />
    </div>
  );
}
```

```jsx
// Lowercase vs capitalized tags resolve completely differently
function profileCard() {           // lowercase function name — a trap!
  return <div>Profile</div>;
}

function App() {
  // <profileCard /> is treated as an (unknown) native HTML tag, NOT a component call —
  // React will warn and render nothing meaningful.
  // return <profileCard />;

  // Renaming to capitalized fixes it: React now treats it as a component reference.
  const ProfileCard = profileCard;
  return <ProfileCard />;
}
```

## Common Pitfalls / Gotchas

- Naming a component with a lowercase first letter — React/JSX will treat the tag as a native HTML element name instead of a component reference, silently failing to render your component's actual output.
- Defining a component function *inside* another component's body — this recreates the inner function (a brand-new identity) on every render of the outer component, which resets any state the inner component holds and hurts performance (see [nesting-components.md](./nesting-components.md) for the full explanation).
- Forgetting that a component must return valid JSX (or `null`/an array/a Fragment) — returning nothing (`undefined`) from a component function is an error, unlike a regular JS function where an implicit `undefined` return is fine.
- Mutating props inside a component — props are meant to be read-only inputs; a component should treat them as immutable and instead lift state up or use its own local state for anything that needs to change.

## Interview Questions & Answers

**Q: What is a React component, mechanically?**
A: In modern React, a component is simply a JavaScript function that returns something React knows how to render — typically JSX, but also strings, numbers, arrays, Fragments, or `null`. There's no required base class or special syntax; any function that returns valid renderable output and follows the capitalized-naming convention can be used as a component.

**Q: Why must component names start with a capital letter?**
A: Because the JSX compiler uses capitalization to decide how to compile a given tag. A lowercase tag (`<div>`) compiles to a string, meaning "render the built-in DOM element with this tag name." A capitalized tag (`<MyButton />`) compiles to a reference to the identifier `MyButton` in scope, meaning "call this function as a component." Lowercase-named components would be misinterpreted as unknown native HTML elements.

**Q: Can a component return multiple sibling elements?**
A: Not directly — a component's `return` is a single JSX expression, so multiple top-level siblings must be wrapped in something: a `<div>` (if a real wrapper element is desired), a Fragment (`<>...</>`) if not, or an array of elements each with a unique `key`.

**Q: What's the difference between a component and an element in React?**
A: A component is the function (or class) definition — the reusable blueprint. An element is the lightweight description object produced by calling/invoking JSX for that component (e.g., what `<MyButton />` compiles to) — it describes *what* to render but isn't itself the rendered output or a DOM node. You can create many elements from one component definition, e.g. by rendering `<MyButton />` multiple times.

**Q: Why is defining a component inside another component's render body considered a bug-prone pattern?**
A: Because the inner function is re-created as a brand-new function identity on every render of the outer component. React uses component identity (along with position in the tree) to decide whether to preserve or discard state between renders, so a "new" component type on every render causes React to unmount and remount the inner component each time, silently resetting any state it held and adding unnecessary render/mount work.

## Related Topics
- [jsx.md](./jsx.md)
- [nesting-components.md](./nesting-components.md)
- [props.md](./props.md)
- [state.md](./state.md)
- [fragments.md](./fragments.md)
- [pure-components.md](./pure-components.md)
