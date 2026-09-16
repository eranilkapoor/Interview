# Introduction to React / Why React

React is a free and open-source front-end JavaScript library for building user interfaces out of components, maintained by Meta together with a large community of individual developers and companies. It exists to solve a specific pain point: before component-driven libraries like React, building an interactive UI meant manually querying the DOM, mutating it in response to events, and manually keeping that DOM in sync with whatever state your application was tracking. That imperative style scales badly — as an app grows, the number of places that can touch a given piece of the DOM grows too, and keeping "what the screen shows" consistent with "what the data says" becomes a full-time bookkeeping job. React flips this around: you describe *what the UI should look like for a given state*, declaratively, and React takes care of figuring out the actual DOM changes needed to get there.

The core unit of a React application is the component — a piece of UI that owns its own logic and appearance, small enough to be a single button or large enough to be an entire page. You build small components like `Thumbnail`, `LikeButton`, or `Video`, and then compose them into bigger components, screens, and eventually full applications, the same way you'd compose small functions into larger programs. This composability is what lets independent developers, teams, and even entire organizations build UI pieces that combine cleanly, because a component is just a self-contained function that takes inputs (props) and returns markup — it doesn't need to know anything about the internals of the components around it.

React components are written using JSX, a JavaScript syntax extension that lets you write markup and the logic that produces it in the same place, in the same language. Rather than separating "template" from "logic" into different files or template languages, JSX lets you use real JavaScript — `if` statements, `.map()` for lists, plain variables — directly alongside the HTML-like markup that describes what should render. This proximity between rendering logic and the markup it produces is a deliberate design choice: it makes components easier to read, create, and delete as a single, self-contained unit, rather than having to hunt through separate template and logic files to understand one piece of UI.

Interactivity comes from state and props: components receive data (as props) and return a description of what should appear on screen, and when the underlying data changes — either because a parent passed new props, or because the component's own local state changed via an event handler — React re-renders the component and computes the minimal set of real DOM updates needed to reflect the new output. This diffing process is often described at a high level as working against a "virtual DOM," a lightweight in-memory representation of the UI that React compares between renders to decide what actually needs to change (see [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md) for the deeper mechanics). Crucially, React itself is *just a library*, not a full framework: it renders components and reconciles updates, but it doesn't prescribe how you do routing, data fetching, or server-side concerns. You can add React incrementally into an existing HTML page and render interactive components anywhere on it, or you can reach for a full-stack framework like Next.js or Remix when you want an opinionated, batteries-included architecture (routing, server components, data fetching conventions) built on top of React. React also follows a "learn once, write anywhere" philosophy — the same component model and mental model you learn for the web transfers directly to native mobile development via React Native, letting teams reuse skills (and often logic) across platforms.

## Examples

```jsx
// A component is just a JavaScript function that returns markup (JSX)
function LikeButton() {
  return <button>❤️ Like</button>;
}

// Small components compose into larger ones
function VideoCard({ title }) {
  return (
    <div className="video-card">
      <h3>{title}</h3>
      <LikeButton />
    </div>
  );
}

export default function App() {
  return (
    <div>
      <h1>My Video App</h1>
      <VideoCard title="Learning React" />
    </div>
  );
}
```

```jsx
// Declarative vs imperative: React lets you describe the "what," not the "how"
// Imperative (vanilla DOM) — you manually track and mutate:
//   const btn = document.querySelector('button');
//   let liked = false;
//   btn.addEventListener('click', () => {
//     liked = !liked;
//     btn.textContent = liked ? 'Liked!' : 'Like';
//   });

// Declarative (React) — you describe UI as a function of state:
import { useState } from 'react';

function LikeToggle() {
  const [liked, setLiked] = useState(false);
  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? 'Liked!' : 'Like'}
    </button>
  );
}
```

```jsx
// React can be dropped into a single element of an existing HTML page —
// it doesn't require a full rewrite of your app.
// <div id="like-widget"></div>  <!-- existing static HTML page -->

import { createRoot } from 'react-dom/client';

function LikeWidget() {
  return <button>Like this page</button>;
}

createRoot(document.getElementById('like-widget')).render(<LikeWidget />);
```

## Common Pitfalls / Gotchas

- Thinking React *is* a framework — it's a UI-rendering library. Routing, data fetching conventions, and server rendering are either handled by separate libraries you choose yourself, or by a framework (Next.js, Remix) built on top of React.
- Assuming you need to rewrite an entire app in React to use it — React was explicitly designed to be adoptable incrementally, one widget or page section at a time, inside existing non-React pages.
- Confusing "declarative" with "magic" — React still ultimately performs real DOM mutations; declarative just means *you* describe the desired output for a given state, and React's reconciliation process figures out the minimal diff, rather than you writing the diff logic by hand.
- Expecting React Native to mean "write once, run everywhere" pixel-for-pixel — it's "learn once, write anywhere": the component model, JSX, hooks, and much of your logic transfer, but platform-specific UI primitives still differ (`<View>`/`<Text>` vs. DOM elements).

## Interview Questions & Answers

**Q: What problem does React actually solve?**
A: It solves the difficulty of keeping a UI in sync with changing data by hand. Instead of imperatively querying and mutating the DOM every time application state changes, you write components that declaratively describe what the UI should look like for any given state, and React computes and applies the necessary DOM updates itself. This scales much better as an application's UI and state grow in complexity.

**Q: Is React a framework?**
A: No — React is a library focused specifically on building and rendering component-based UIs. It deliberately doesn't prescribe routing, data fetching, or server architecture. Full-stack frameworks like Next.js or Remix are built on top of React and add those opinionated pieces; you can also use React standalone and pick your own tools for everything else.

**Q: What is a React component, fundamentally?**
A: A component is a JavaScript function that accepts inputs (props) and returns a description of UI (typically JSX) that React knows how to render to the screen. Components can be composed — small components nested inside larger ones — to build up an entire application from independent, reusable pieces.

**Q: Can you add React to an existing non-React website?**
A: Yes. React doesn't require owning the entire page — you can mount a React root onto a single DOM node inside an existing server-rendered or static HTML page and render interactive components just in that spot, leaving the rest of the page untouched. This is a common incremental-adoption path for legacy applications.

**Q: What does "learn once, write anywhere" mean in the context of React and React Native?**
A: It means the core mental model — components, props, state, hooks, JSX, unidirectional data flow — is the same whether you're targeting the web with React or targeting iOS/Android with React Native. The underlying rendering primitives differ (DOM elements like `<div>` vs. native primitives like `<View>`), so UI code isn't automatically portable, but the skills, patterns, and often a good portion of non-UI logic are.

## Related Topics
- [components.md](./components.md)
- [jsx.md](./jsx.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
- [state.md](./state.md)
- [props.md](./props.md)
- [server-side-rendering.md](./server-side-rendering.md)
