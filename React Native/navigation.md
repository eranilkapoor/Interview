# Navigation

React Native has no built-in router — unlike the web, there's no URL bar, no browser history stack, and no native concept of "going back" that the framework provides for free. **React Navigation** (the de facto standard, currently on v6/v7) fills that gap entirely in JS: it maintains its own navigation state tree (which screens are on which stack, in what order, with what params) and renders native-feeling transitions on top of it. The alternative, `react-native-screens`-backed native navigation aside, React Navigation is what the overwhelming majority of production RN apps and almost all interview questions on this topic assume.

Everything sits inside a single `NavigationContainer` at the root of the app, which owns the overall navigation state and (optionally) the `linking` config for deep links. Inside it, you compose **navigators** — `createNativeStackNavigator()` for the common "push a new screen, swipe back" pattern (backed by native `UINavigationController`/Fragment transitions via `react-native-screens`, which is why it's preferred over the older, JS-driven `createStackNavigator`), `createBottomTabNavigator()` for tab bars, and `createDrawerNavigator()` for a slide-out side menu. Each navigator is created once via its factory function, then rendered as `<Navigator>`/`<Screen>` JSX, with each `<Screen>` mapping a route name to a component. Navigators nest freely — a very common shape is a bottom tab navigator where one or more tabs is itself a native stack navigator, so tapping into a tab can push further screens while the tab bar stays visible (or hides, depending on `tabBarStyle`/`headerShown` configuration on the nested screens).

Screens read and manipulate navigation state via hooks rather than props drilling: `useNavigation()` returns the navigation object (`navigate`, `push`, `goBack`, `replace`, `setParams`, ...) from anywhere in the component tree under a navigator, and `useRoute()` returns the current route object, including `route.params`. `navigation.navigate('ScreenName', params)` is subtly different from `navigation.push('ScreenName', params)`: `navigate` will go *back* to an existing instance of that screen already in the stack if one exists (or update its params), while `push` always adds a brand-new instance onto the stack even if the same screen is already there — the distinction matters for flows like "tap into item A, then tap into item B of the same screen type," where `push` correctly stacks both while `navigate` would just re-focus the first one. `replace` swaps the current screen out of the stack instead of adding on top of it (useful after a login screen, so the user can't swipe/back into it), and `goBack()` pops the current screen — calling it when there's nothing to go back to is a no-op in most configurations but should generally be guarded with `navigation.canGoBack()` in code that might run from a deep-linked, stack-less entry point.

Passing params is done as the second argument to `navigate`/`push` (`navigation.navigate('Profile', { userId: 42 })`) and read on the destination screen via `route.params.userId`; in TypeScript, this is typically made type-safe by declaring a `RootStackParamList` type mapping each route name to its params shape and passing it to `createNativeStackNavigator<RootStackParamList>()`, so `navigate` calls are checked against the right param shape for each screen name at compile time. `screenOptions` (set at the navigator level) and per-screen `options` (set on individual `<Screen>` elements, or dynamically via a function receiving `route`/`navigation`) control header title, back-button behavior, `headerShown`, gestures, and transition animations — options set at the wrong level (e.g., trying to hide the tab bar from a screen options prop on the *stack* navigator nested inside a tab, rather than on the *tab* navigator itself) is one of the most common configuration mistakes. Deep linking ties in through the `linking` prop on `NavigationContainer`, covered in depth in [deep-linking.md](./deep-linking.md).

## Examples

```tsx
// Typed stack navigator with params, plus navigate vs push distinction
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  return (
    <Button
      title="View profile"
      onPress={() => navigation.navigate('Profile', { userId: 'u_123' })}
    />
  );
}

function ProfileScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const navigation = useNavigation();
  return (
    <>
      <Text>Viewing profile: {route.params.userId}</Text>
      {/* push adds a new instance even if a Profile screen is already in the stack */}
      <Button title="View another user" onPress={() => navigation.push('Profile', { userId: 'u_456' })} />
      <Button title="Back" onPress={() => navigation.canGoBack() && navigation.goBack()} />
    </>
  );
}

function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'User Profile' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

The `RootStackParamList` type is what makes `navigation.navigate('Profile', { userId: 'u_123' })` type-checked — passing a mistyped route name or missing/wrong-shaped params is a compile error, not a runtime surprise.

```jsx
// Bottom tabs with a nested native stack inside one tab
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const HomeStack = createNativeStackNavigator();
function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name="Feed" component={FeedScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
    </HomeStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();
function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
```

Pushing `PostDetail` from inside `Feed` keeps the tab bar visible and stacks on top of the `Home` tab specifically — the `Settings` tab's own (separate) navigation state is untouched, which is why React Navigation gives each tab its own independent stack by default.

```jsx
// Drawer navigator + deep-link-aware linking config skeleton
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';

const Drawer = createDrawerNavigator();

const linking = {
  prefixes: ['myapp://', 'https://myapp.com'],
  config: {
    screens: {
      HomeTab: 'home',
      Profile: 'profile/:userId',
    },
  },
};

function App() {
  return (
    <NavigationContainer linking={linking} fallback={<LoadingScreen />}>
      <Drawer.Navigator>
        <Drawer.Screen name="HomeTab" component={AppTabs} />
        <Drawer.Screen name="Profile" component={ProfileScreen} />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}
```

The `config.screens` map is what translates an incoming URL like `myapp://profile/u_123` into a navigation action equivalent to `navigation.navigate('Profile', { userId: 'u_123' })` — see [deep-linking.md](./deep-linking.md) for the full mechanics, including the native-side URL scheme registration this config alone doesn't cover.

## Common Pitfalls / Gotchas

- Confusing `navigate` and `push` — `navigate('X', params)` reuses an existing `X` screen already in the stack (updating its params) instead of adding a new one, while `push('X', params)` always stacks a new instance; using the wrong one produces either an unexpected "nothing happened" navigation or an unexpectedly deep stack.
- Calling `navigation.goBack()` without checking `navigation.canGoBack()` from a screen that might be the *first* screen in its stack (e.g., reached via a deep link with no prior history) — this can be a silent no-op or, in custom-handled cases, an error depending on how the app structures its back-button logic.
- Passing non-serializable values (functions, class instances) as route params — React Navigation persists navigation state for restoration and warns loudly about this in development; params should be plain, serializable data (IDs, strings, numbers), with the actual objects fetched/looked up on the destination screen.
- Setting screen options like hiding the tab bar on the wrong navigator level — e.g., putting `tabBarStyle: { display: 'none' }` in a nested stack screen's `options` does nothing, because that option belongs to the *tab navigator*, not the stack screen nested inside one of its tabs; it has to be set via the tab navigator's own screen options, often keyed off the currently focused nested route.
- Forgetting that each tab in a bottom tab navigator keeps its own independent navigation stack by default — switching tabs and switching back preserves whatever screen you'd pushed in that tab, which is usually desired but surprises people expecting each tab switch to reset to that tab's root screen.
- Misconfiguring the `linking` prop's `config.screens` map relative to the actual navigator nesting — a screen nested two navigators deep needs its path declared as a nested object matching that structure, not as a flat top-level key, or incoming deep links silently fail to navigate anywhere and just open to the default/initial screen.

## Interview Questions & Answers

**Q: What's the actual difference between `navigation.navigate()` and `navigation.push()`, and when would you pick one over the other?**
A: `navigate('ScreenName', params)` checks whether a screen with that name already exists in the current stack; if it does, it jumps back to that existing instance and merges in the new params rather than adding a new screen. `push('ScreenName', params)` skips that check entirely and always adds a fresh instance onto the stack. You'd use `push` for something like "view another user's profile from within a profile screen," where you genuinely want a new screen instance stacked on top (so back navigation steps through each profile visited), and `navigate` for simpler cases like tab-style navigation between top-level sections where re-focusing an existing screen is the expected behavior.

**Q: How do you type route params in a React Navigation app, and why bother?**
A: You declare a param list type — typically `type RootStackParamList = { Home: undefined; Profile: { userId: string } }` — and pass it as a generic to `createNativeStackNavigator<RootStackParamList>()`. From there, `useNavigation<NativeStackNavigationProp<RootStackParamList, 'ScreenName'>>()` and `useRoute<RouteProp<RootStackParamList, 'ScreenName'>>()` give you compile-time checking that `navigate` calls pass the right params for a given route name, and that `route.params` on the destination screen has the correct shape — catching typos in route names or missing/mistyped params before runtime instead of after.

**Q: How does nested navigation work — for example, a stack navigator inside one tab of a bottom tab navigator?**
A: Each navigator manages its own independent piece of navigation state. When a stack navigator is rendered as the `component` for one tab, that tab effectively gets its own back-stack: pushing new screens within that tab doesn't affect the other tabs' states, and switching tabs preserves each tab's stack rather than resetting it. This nesting composes arbitrarily — a drawer can contain tabs, tabs can contain stacks, stacks can contain further nested navigators — and `useNavigation()`/`useRoute()` from any given screen always refer to the nearest enclosing navigator's state unless you explicitly reach up via `navigation.getParent()`.

**Q: How does React Navigation integrate with deep linking?**
A: Via the `linking` prop passed to `NavigationContainer`, which takes a `prefixes` array (the URL schemes/domains the app should respond to) and a `config.screens` object mapping route names to URL path patterns, including dynamic segments like `profile/:userId` that map directly onto route params. When the app receives a URL matching one of those prefixes — whether at cold start or while already running — React Navigation parses it against the config and synthesizes the equivalent navigation action automatically, without you having to manually parse the URL and call `navigate` yourself.

**Q: A tab bar isn't hiding on a screen nested inside a stack that's nested inside a bottom tab navigator — what's the likely misconfiguration?**
A: The `tabBarStyle`/`tabBarVisible`-style options were almost certainly set on the wrong navigator — most likely as `options` on the individual stack screen, when tab bar visibility is actually controlled by the *tab navigator's* own screen options. The fix is typically to set the tab navigator's `screenOptions` as a function that reads the currently focused nested route name (via `getFocusedRouteNameFromRoute`) and conditionally returns `{ tabBarStyle: { display: 'none' } }` for the specific nested screen that should hide it.

## Related Topics
- [deep-linking.md](./deep-linking.md)
- [state-management.md](./state-management.md)
- [core-components.md](./core-components.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [../React/use-context.md](../React/use-context.md)
- [../React/props.md](../React/props.md)
