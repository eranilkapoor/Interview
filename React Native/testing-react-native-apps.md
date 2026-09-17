# Testing React Native Apps

React Native's testing story spans three distinct layers, each catching different classes of bugs and each with a different cost-to-confidence ratio: unit/component tests running entirely in Node (fast, no simulator needed), integration tests that render component trees and simulate user interaction against mocked native modules, and true end-to-end tests that drive a real simulator/emulator or physical device through the compiled app. A strong interview answer distinguishes these layers explicitly, because conflating "I wrote a snapshot test" with "the app is well-tested" is a common junior mistake.

**Jest** is the default test runner in every React Native project scaffolded with the RN CLI or Expo — it ships preconfigured (`jest.config.js`, a `preset: 'react-native'`) and requires no additional setup to run `describe`/`it`/`expect` blocks. Jest handles test discovery, assertion matching, mocking, and snapshot serialization, and it runs entirely in a Node environment with a simulated (jsdom-like, but RN-specific) module environment — meaning no simulator, no native code actually executes, and any call that would normally cross into real native APIs must be mocked.

**React Native Testing Library** (RNTL, the RN sibling of React Testing Library) is the standard for component/integration tests. Its core philosophy — "test behavior, not implementation" — pushes you to query the rendered output the way a user would encounter it (by visible text, accessibility role, or an explicit `testID`) rather than reaching into component internals or state. `render()` mounts a component tree in the simulated environment and returns query utilities plus a `screen` object; `fireEvent` simulates user interactions (`fireEvent.press`, `fireEvent.changeText`); `waitFor` polls an assertion until it passes or times out, essential for anything that updates asynchronously (a fetch resolving, a state update after a promise). Because RN has no accessible DOM the way a browser does, `testID` is the most common query anchor in practice, though RNTL also supports querying by accessible role/label, which doubles as a way to catch missing accessibility labeling.

Testing in React Native almost always requires **mocking native modules**, since Jest's Node environment can't execute real Objective-C/Java/Kotlin code. Common mocks: `@react-native-async-storage/async-storage` ships an official Jest mock (`jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))`); `NativeModules` entries not covered by RN's built-in mocks need manual `jest.mock()` stubs matching the shape the real module would return; and `react-native-reanimated` ships its own Jest preset/mock (`react-native-reanimated/jest`) because its worklets and native-thread animation driver can't run in Jest's environment at all — without it, tests using Reanimated typically throw immediately.

For true **end-to-end (E2E) testing**, **Detox** is the dominant RN-specific tool, distinguishing itself from generic mobile-automation tools like Appium through its "gray-box" design: rather than treating the app as an opaque black box and polling/sleeping to wait for UI to settle (Appium's typical approach, which leads to flaky, timing-dependent tests), Detox instruments the app itself to track pending async work — network requests, timers, animations, the JS event loop — and automatically synchronizes each test step to wait until the app is actually idle before proceeding. This makes Detox tests substantially less flaky than black-box tools for a JS-driven UI, at the cost of Detox needing platform-specific native build configuration and only running against real compiled builds (a real simulator or physical device), not the Jest-simulated environment.

**Snapshot testing** (`expect(tree).toMatchSnapshot()`) serializes a rendered component tree to a text file and fails future runs if the output changes. Its value is real but narrow: it's good at catching *accidental* UI changes in components that are expected to stay stable, but it has a well-known failure mode in team practice — when a snapshot test fails, the path of least resistance is running `jest --ci=false -u` to regenerate the snapshot without actually reviewing whether the change was correct, which turns the test into a no-op rubber stamp rather than a real check. Interviewers often want to hear this tradeoff articulated rather than snapshot testing presented as an unambiguous good.

## Examples

```jsx
// React Native Testing Library: querying by testID/role, firing events, awaiting async state
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginForm from './LoginForm';

test('submits the entered credentials', async () => {
  const onSubmit = jest.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  fireEvent.changeText(screen.getByTestId('email-input'), 'user@example.com');
  fireEvent.changeText(screen.getByTestId('password-input'), 'hunter2');
  fireEvent.press(screen.getByRole('button', { name: /log in/i }));

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', password: 'hunter2' })
  );
});
```

This tests observable behavior — what the user typed and pressed, and what callback fired as a result — rather than reaching into component state, so the test survives internal refactors that don't change user-facing behavior.

```js
// jest.setup.js — mocking AsyncStorage and a Reanimated preset
import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-reanimated needs its own Jest preset because worklets can't
// run in Jest's Node environment; without this, tests touching Reanimated throw.
require('react-native-reanimated/jest');
```

```js
// jest.config.js
module.exports = {
  preset: 'react-native',
  setupFilesAfterEach: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-reanimated)/)',
  ],
};
```

Most RN native-module-dependent libraries ship as untranspiled ES modules inside `node_modules`, so `transformIgnorePatterns` has to be adjusted to let Jest's Babel transform run over them — a very common source of "unexpected token" failures in RN test suites when a new native-backed dependency is added.

```js
// Detox: an E2E test driving the real compiled app on a simulator, synchronized automatically
describe('Login flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('logs in and lands on the home screen', async () => {
    await element(by.id('email-input')).typeText('user@example.com');
    await element(by.id('password-input')).typeText('hunter2');
    await element(by.id('login-button')).tap();

    // No manual wait/sleep needed — Detox blocks until the app's pending
    // network request and navigation transition both settle.
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});
```

Unlike an Appium test that would need explicit polling or sleeps to wait for the login network call and screen transition to finish, Detox's gray-box synchronization tracks the app's in-flight async work directly and only proceeds once it's idle.

## Common Pitfalls / Gotchas

- Forgetting to mock a native-backed module (AsyncStorage, a device-info library, Reanimated) and getting a confusing "native module cannot be null" or similar error in a test that never touches a real device — this almost always means a missing or incomplete Jest mock.
- Blindly running `jest -u` to fix a failing snapshot test without reviewing the diff — this turns snapshot testing from a regression guard into a rubber stamp that approves whatever the code currently produces, including actual bugs.
- Using `getByTestId` for everything by default instead of querying by role/text where reasonable — over-relying on `testID` couples tests tightly to markup and misses opportunities to catch missing accessibility labels, which role/label-based queries would surface.
- Forgetting `await waitFor(...)` around assertions on state that updates asynchronously (after a fetch, a timer, a navigation transition) — the assertion runs before the update happens and fails intermittently or immediately, depending on timing.
- Assuming Detox tests can run against the Jest-simulated environment — Detox requires an actual compiled app running on a real simulator/emulator/device; it's a fundamentally different test target than Jest/RNTL component tests, with its own build step (`detox build`) before `detox test`.
- Not adjusting `transformIgnorePatterns` in `jest.config.js` when adding a new native-backed dependency shipped as untranspiled ESM — causes cryptic "SyntaxError: Unexpected token" failures that have nothing to do with the actual test logic.

## Interview Questions & Answers

**Q: What's the practical difference between a Jest/RNTL component test and a Detox E2E test?**
A: A Jest/RNTL test runs entirely in Node with no real simulator and no real native code — any native module interaction has to be mocked, and it's testing your JS component logic and rendering in isolation, which makes it fast (milliseconds per test) and suitable for running on every commit. A Detox test runs the actual compiled app on a real simulator or device, exercising real native code, real navigation, and real timing, which makes it slower and more infrastructure-heavy but able to catch integration issues — like a native module misconfiguration or a real navigation bug — that a mocked Jest test structurally cannot see.

**Q: Why does Detox claim to be less flaky than Appium-based E2E testing?**
A: Detox uses a "gray-box" approach: it instruments the app itself to track pending asynchronous work — network calls, timers, the JS event loop, animations — and automatically waits for the app to be idle between each test action, rather than the test author guessing how long to sleep or poll. Appium, by contrast, treats the app as an opaque black box with no visibility into what it's doing internally, so Appium-style tests typically rely on explicit waits or polling for elements to appear, which is inherently timing-dependent and more prone to intermittent failures under different device speeds or CI load.

**Q: How do you handle a component that calls AsyncStorage or another native module in a Jest test?**
A: You mock the module before the component under test is imported, typically in a Jest setup file or via `jest.mock()` at the top of the test file, returning a fake implementation that mimics the real API's shape (e.g., AsyncStorage's official Jest mock backs `getItem`/`setItem` with an in-memory object). Without the mock, Jest's Node environment has no real native bridge to call into, so any attempt to invoke the real native module throws — the fix is never to try to make native code run in Jest, it's to substitute a JS-only stand-in that satisfies the same interface.

**Q: What's the actual value of snapshot testing, and what's its main failure mode in practice?**
A: Snapshot tests are genuinely useful for catching *unintentional* UI changes in components expected to stay visually/structurally stable — a refactor that accidentally changes markup will fail the snapshot even if no one meant to change the output. The failure mode is social, not technical: when a snapshot fails, developers under time pressure often just regenerate it with `jest -u` without actually reviewing whether the new output is correct, which silently converts every future run of that test into an approval of whatever the code currently does rather than a real regression check.

**Q: Why is React Native Testing Library's philosophy of "test behavior, not implementation" particularly relevant in RN specifically?**
A: RN components frequently wrap native views and complex gesture/animation logic where internal implementation details (which specific Touchable was used, how state is structured internally) are especially likely to change during refactors or library migrations (e.g., swapping `TouchableOpacity` for `Pressable`). Testing via user-observable behavior — what's rendered, what happens when a user presses or types — means those internal changes don't break the test suite as long as the user-facing behavior is preserved, whereas implementation-coupled tests (asserting on internal state or specific component instances) break on every such refactor regardless of whether anything user-facing actually changed.

## Related Topics
- [debugging-react-native-apps.md](./debugging-react-native-apps.md)
- [async-storage.md](./async-storage.md)
- [gesture-handling.md](./gesture-handling.md)
- [accessibility.md](./accessibility.md)
- [../React/react-testing-basics.md](../React/react-testing-basics.md)
