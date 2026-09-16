# React Testing Basics

Testing React components typically involves two layers working together: Jest (or a compatible runner like Vitest) as the test runner and assertion library — it discovers test files, runs them, provides `describe`/`test`/`it` blocks and `expect(...)` assertions, and handles mocking — and React Testing Library (RTL) as the layer specifically for rendering components and interacting with them the way a real user would. RTL's guiding philosophy, often summarized as "test behavior, not implementation," is that tests should interact with your component the same way an actual user does — by finding visible text, clicking buttons, typing into fields — rather than reaching into a component's internal state, calling its methods directly, or asserting on CSS class names/implementation details that a user never sees and that can change without any actual behavior change.

This philosophy directly shapes RTL's API design: its query functions (`getByRole`, `getByText`, `getByLabelText`, `getByPlaceholderText`, and their `queryBy`/`findBy` variants) are deliberately built around how users and assistive technology actually perceive the page, with `getByRole` (querying by ARIA role — "button," "textbox," "heading") explicitly recommended as the first choice, because it doubles as a check that the UI is accessible in the first place. This is a deliberate departure from older testing approaches (like Enzyme's `shallow` rendering and internal-state inspection) that tightly coupled tests to implementation details — a refactor that changed *how* a component achieved some behavior, without changing the behavior itself, would break an Enzyme-style test but should leave an RTL test passing unchanged, since RTL never looked at the implementation to begin with.

A typical RTL test renders a component with `render(<MyComponent />)`, queries for elements via `screen.getByRole(...)`/`screen.getByText(...)`, simulates user interaction with `fireEvent` (lower-level, dispatches a single DOM event) or the preferred `@testing-library/user-event` (higher-level, simulates a more realistic sequence of events — e.g., `userEvent.type()` fires individual keydown/keypress/input events per character, closer to what actually happens when a real user types), and then asserts on the resulting, visible output. Because many components involve asynchronous behavior — data fetching that resolves after a render, a debounced update, an animation completing — RTL provides `findBy*` queries (which return a Promise that resolves once the element appears, or rejects after a timeout) and a standalone `waitFor(callback)` utility (which retries the callback until it stops throwing or a timeout is hit), both essential for correctly testing components that don't show their final state synchronously on first render.

Snapshot testing (Jest's `toMatchSnapshot()`) is a different, complementary technique — instead of asserting specific properties, it serializes a component's rendered output and compares it against a previously saved reference, failing the test if anything differs. It's useful for catching *any* unintended change to a component's output, but has real tradeoffs: large or frequently-changing snapshots tend to accumulate "just re-approve it" habits from developers who don't carefully review every diff, which erodes their value as an actual safety net — they're best used sparingly, on small, stable pieces of output, rather than as a default testing strategy. Finally, tests should mock network requests rather than hitting a real backend — commonly via Jest's `jest.mock()` to replace an API module with a fake implementation, or a request-interception library like Mock Service Worker (MSW) that intercepts actual `fetch`/`XHR` calls at the network level, letting you test loading/success/error states deterministically without any real server involved.

## Examples

```jsx
// Basic RTL test: render, query by role, fire an event, assert on the result
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Counter from './Counter';

test('increments the count when the button is clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  const button = screen.getByRole('button', { name: /increment/i });
  await user.click(button); // realistic click simulation via user-event

  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

```jsx
// Async data fetching: findBy* / waitFor for content that appears after a delay
import { render, screen, waitFor } from '@testing-library/react';
import UserProfile from './UserProfile';
import { fetchUser } from './api';

jest.mock('./api'); // replace the real API module with a Jest mock

test('shows the user name once the fetch resolves', async () => {
  fetchUser.mockResolvedValueOnce({ id: 1, name: 'Anil' });
  render(<UserProfile userId={1} />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument(); // initial loading state

  // findByText waits for the element to appear (up to a timeout), for async UI
  const name = await screen.findByText('Anil');
  expect(name).toBeInTheDocument();

  // Equivalent alternative using waitFor directly:
  await waitFor(() => {
    expect(fetchUser).toHaveBeenCalledWith(1);
  });
});
```

```jsx
// Testing behavior, not implementation: querying by accessible role/label,
// never by internal state or CSS class names.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';

test('submits the entered credentials', async () => {
  const user = userEvent.setup();
  const handleSubmit = jest.fn();
  render(<LoginForm onSubmit={handleSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'anil@example.com');
  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /log in/i }));

  expect(handleSubmit).toHaveBeenCalledWith({
    email: 'anil@example.com',
    password: 'secret123',
  });
});
```

## Common Pitfalls / Gotchas

- Querying by CSS class name or `data-testid` as the first choice instead of `getByRole`/`getByLabelText` — role/label-based queries double as an accessibility check (if you can't find an element by its role, a screen reader user likely can't find it either), while class-name queries couple the test to styling details that can change without any real behavior change.
- Using `fireEvent.click()` when `userEvent.click()` would more accurately simulate what a real user's interaction actually triggers — `user-event` fires a fuller, more realistic sequence of underlying events (hover, focus, mousedown, mouseup, click for a click; individual keystrokes for typing), catching bugs that a single synthetic `fireEvent` call would miss.
- Forgetting to `await` a `findBy*` query or a `user-event` interaction — both are asynchronous, and forgetting to await them causes assertions to run before the awaited state actually settles, leading to flaky, intermittently-failing tests.
- Over-relying on snapshot tests as the primary testing strategy — large snapshots are easy to blindly re-approve without actually reviewing what changed, which silently erodes their value as a safety net; they're best reserved for small, stable output where an unexpected diff is genuinely meaningful.
- Letting tests hit a real network/backend instead of mocking API calls — this makes tests slow, flaky (dependent on external service availability), and unable to deterministically exercise error/edge-case states (a 500 response, a timeout) that are hard to trigger against a real server on demand.
- Testing implementation details by reaching into a component instance or its internal state directly (an Enzyme `shallow`-rendering habit) — RTL deliberately doesn't expose this, since a passing test should reflect "the user-visible behavior still works," not "the internal implementation is unchanged."

## Interview Questions & Answers

**Q: What does "test behavior, not implementation" mean in the context of React Testing Library, and why does it matter?**
A: It means tests should interact with a component the way an actual user does — finding elements by their visible text or accessible role, clicking and typing — rather than inspecting internal component state or implementation-specific details like CSS class names. This matters because it makes tests resilient to refactors: if you change *how* a component achieves some behavior (say, switching from local state to a different state management approach) without changing what the user actually sees or can do, a behavior-focused test keeps passing, whereas an implementation-coupled test would break for no user-relevant reason.

**Q: What's the difference between `fireEvent` and `@testing-library/user-event`, and why is `user-event` generally preferred?**
A: `fireEvent` dispatches a single, specific DOM event directly (e.g., one `click` event). `user-event` simulates a fuller, more realistic sequence of events that would actually occur during that interaction — clicking involves hover/focus/mousedown/mouseup/click, typing fires individual keydown/keypress/input events per character — which more accurately exercises event handlers a real user interaction would trigger (like a focus handler, or an `onChange` firing per keystroke rather than all at once), catching bugs `fireEvent`'s more artificial single-event dispatch could miss.

**Q: How would you test a component that fetches data asynchronously and shows a loading state, then the result?**
A: Render the component, first assert the loading state is visible (e.g., `screen.getByText(/loading/i)`), then use an async query like `await screen.findByText(...)` (which polls until the element appears or times out) or `await waitFor(() => expect(...))` to assert on the state that appears once the fetch resolves. The underlying API call itself should be mocked (via `jest.mock()` or a network-interception tool like MSW) so the test is deterministic and doesn't depend on a real network request.

**Q: What are the tradeoffs of snapshot testing, and when is it actually useful?**
A: Snapshot tests automatically catch any change to a component's rendered output by comparing it against a saved reference, which is useful for flagging unintended changes without writing specific assertions for every detail. The downside is that large or frequently-changing snapshots tend to get blindly re-approved (`--updateSnapshot`) by developers under time pressure without actually reviewing the diff, which defeats their purpose as a safety net. They work best on small, relatively stable pieces of output, used sparingly rather than as a default, primary testing strategy.

**Q: Why should API calls be mocked in component tests instead of hitting a real backend?**
A: Mocking keeps tests fast, deterministic, and independent of external service availability or network conditions, and — importantly — it lets you deliberately simulate states that are hard to reliably trigger against a real server on demand, like an error response, a slow/timed-out request, or a specific edge-case payload, so you can verify the component handles each of those states correctly.

## Related Topics
- [use-effect.md](./use-effect.md)
- [controlled-vs-uncontrolled-components.md](./controlled-vs-uncontrolled-components.md)
- [handling-events.md](./handling-events.md)
- [error-boundaries.md](./error-boundaries.md)
- [components.md](./components.md)
