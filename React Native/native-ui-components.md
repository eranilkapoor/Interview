# Native UI Components

Native UI Components (sometimes called Native View Managers in the legacy architecture, or Fabric Native Components in the New Architecture) solve a different problem from Native Modules. A Native Module exposes native *functions* to JS — you call a method and get a value or a Promise back, but nothing appears on screen as a direct result. A Native UI Component exposes a native *view* — an actual native `UIView` (iOS) or `android.view.View` (Android) — that gets mounted into the RN view hierarchy and rendered on screen alongside your JS-driven components, participating in RN's layout system like any other component even though what's actually drawing pixels is native platform code. You reach for this when you need to embed real native UI that RN's own core components can't express: wrapping a native map SDK (Google Maps/Apple Maps/Mapbox's native views), a native video player, a native ad SDK's view, or a platform-specific widget that has no JS equivalent and would be prohibitively hard to reimplement from scratch in pure JS/RN.

In the legacy architecture, this is built with `requireNativeComponent(componentName)` on the JS side, paired with a native "View Manager" (`ViewManager` subclass on Android, `RCTViewManager` subclass on iOS/Objective-C) that's responsible for creating instances of the native view, and for defining which props RN is allowed to set on it. Props flow one direction naturally here: JS re-renders with new prop values, RN's reconciler diffs them, and for any changed prop the View Manager's corresponding native setter method is invoked to update the actual native view instance — conceptually similar to how RN updates any host component's underlying platform view, just for a custom native view instead of a built-in one like `View` or `Text`. Events flow the other direction: native code fires an event (a tap on the native map, a video finishing playback) by sending it back across to JS, where it surfaces as a normal-looking prop callback (`onMapPress`, `onVideoEnd`) that you pass to the component just like any other event handler in RN.

The New Architecture's equivalent is a Fabric Native Component, defined via a Codegen spec file much like a TurboModule's spec — describing the component's props and events with real types — from which Codegen generates the native interface code on both platforms. The underlying rendering pipeline (Fabric) also changes how view updates are computed and committed: layout and view-tree diffing happen on a C++ core shared across platforms, and native view mutations can be applied more directly and synchronously than the old bridge-based view manager flow allowed, which reduces the same kind of overhead TurboModules eliminate for function calls — less serialization, less async hopping, more direct communication between JS's shadow tree and the actual native views.

Whichever architecture you're targeting, the mental model to hold onto for interviews is the props-down/events-up split: props are how JS configures and updates the native view declaratively (RN owns the "what should this look like" side), and events are how the native view reports things happening (RN owns the "translate this native occurrence into a normal-feeling JS callback" side) — the native view itself never reaches back into JS state directly, it only ever emits events, keeping the same unidirectional data flow RN uses everywhere else, just extended across the JS/native boundary instead of staying purely in JS.

## Examples

```jsx
// Legacy architecture: requireNativeComponent wraps a native view manager
// registered on both platforms under the name "RNCustomMapView".
import { requireNativeComponent } from 'react-native';

const RNCustomMapView = requireNativeComponent('RNCustomMapView');

function MapScreen() {
  return (
    <RNCustomMapView
      style={{ flex: 1 }}
      initialRegion={{ latitude: 37.78, longitude: -122.41, zoomLevel: 12 }}
      onMarkerPress={(event) => {
        // native code emits a custom event; RN surfaces it as a normal prop callback
        console.log('Marker tapped:', event.nativeEvent.markerId);
      }}
    />
  );
}
```

```java
// Android (Kotlin), legacy ViewManager side: creates the native view and
// exposes a settable prop that RN calls whenever the JS-side prop changes.
class CustomMapViewManager : SimpleViewManager<MapView>() {
  override fun getName() = "RNCustomMapView"

  override fun createViewInstance(context: ThemedReactContext): MapView {
    return MapView(context)
  }

  @ReactProp(name = "initialRegion")
  fun setInitialRegion(view: MapView, region: ReadableMap) {
    view.moveCamera(region.getDouble("latitude"), region.getDouble("longitude"))
  }
}
```

```ts
// New Architecture: a Fabric Native Component spec, Codegen'd on both platforms.
// RNCustomMapViewNativeComponent.ts
import type { ViewProps } from 'react-native';
import type { Int32, Double } from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { DirectEventHandler } from 'react-native/Libraries/Types/CodegenTypes';

interface MarkerPressEvent {
  markerId: Int32;
}

interface NativeProps extends ViewProps {
  latitude: Double;
  longitude: Double;
  onMarkerPress?: DirectEventHandler<MarkerPressEvent>;
}

export default codegenNativeComponent<NativeProps>('RNCustomMapView');

// Usage in a screen — indistinguishable from using any other RN component:
import CustomMapView from './RNCustomMapViewNativeComponent';
<CustomMapView latitude={37.78} longitude={-122.41} onMarkerPress={handlePress} />;
```

## Common Pitfalls / Gotchas

- Confusing Native Modules with Native UI Components — a Native Module exposes callable functions with no view on screen; a Native UI Component renders an actual native view into the tree. Needing to both call native functions *and* render a native view for the same feature (e.g., a map SDK with both a view and imperative methods like `animateToRegion`) often means building both, wired together.
- Forgetting that prop updates on a native view only fire the native setter for props that actually changed between renders — a prop object recreated fresh on every render (a new object literal with the same values) can look "changed" by reference and trigger unnecessary native updates, similar to the `React.memo` shallow-comparison pitfall in plain React.
- Not making native event payloads match what the JS side expects — native code emitting an event with a differently-shaped or -typed payload than the Codegen spec (or, in the legacy world, than what the JS caller destructures from `event.nativeEvent`) fails silently or crashes only at runtime, since the legacy bridge has no compile-time type checking across the boundary.
- Treating `style` (especially `flex`, width/height) as automatically respected by a custom native view — the native View Manager has to actually apply RN's computed layout to the underlying native view; a naive implementation can end up with a native view that doesn't resize correctly inside flex layouts.
- Assuming a native UI component behaves like a controlled React component out of the box — because state changes on the native side (e.g., a map that's been panned by the user's gesture) don't automatically propagate back into JS state unless the native code explicitly emits an event for it, it's easy to end up with JS-side state that's silently out of sync with what's actually on screen.
- Skipping platform parity — building and testing the native view manager thoroughly on one platform while the other platform's implementation lags behind or throws, which (as with native modules generally) tends to surface late, often during QA or in production on the neglected platform.

## Interview Questions & Answers

**Q: What's the difference between a Native Module and a Native UI Component?**
A: A Native Module exposes native *functions* to JS as callable methods — nothing renders on screen as a result, it's pure logic/data (e.g., reading a device ID, accessing a hardware API). A Native UI Component exposes an actual native *view* that gets mounted into RN's rendered UI tree and participates in layout — used for embedding native UI that RN core can't express, like a native map SDK's view or a native video player. Some features need both: a native view for rendering plus a native module (or imperative methods on the component) for programmatic control.

**Q: How do props and events flow between JS and a custom native view?**
A: Props flow JS-to-native: when JS re-renders with changed prop values, RN's reconciler diffs them and invokes the corresponding native setter method on the View Manager (legacy) or the Fabric-generated interface (New Architecture) to update the actual native view. Events flow native-to-JS: the native view fires an event when something happens (a tap, a gesture, playback finishing), which crosses back into JS and surfaces as a normal-looking callback prop like `onPress` or `onVideoEnd` that you attach just like any other RN event handler — the native view never reaches into JS state directly.

**Q: What is `requireNativeComponent` and what does it require on the native side?**
A: `requireNativeComponent(name)` is the legacy-architecture JS API that returns a usable React component backed by a native view registered under that name. It requires a matching native View Manager on each platform (a `ViewManager`/`SimpleViewManager` subclass on Android, an `RCTViewManager` subclass on iOS) that creates instances of the native view and declares, via prop setter methods (annotated with `@ReactProp` on Android, for example), which props RN is allowed to set on it.

**Q: How does the Fabric/New Architecture approach to native components differ from the legacy View Manager approach?**
A: Fabric Native Components are defined via a strongly-typed Codegen spec (like a TurboModule's spec) describing props and events, from which native interface code is generated on both platforms — giving compile-time consistency between the JS contract and the native implementation, the same benefit TurboModules bring to native functions. The underlying rendering pipeline also changes: layout and tree diffing happen in a shared C++ core, and view mutations can be committed more directly, reducing the serialization and async-bridge overhead the legacy View Manager flow had.

**Q: Give a concrete example of when you'd build a custom Native UI Component rather than composing existing RN components.**
A: Integrating a native map SDK (e.g., wrapping Apple Maps/Google Maps native views directly, as libraries like `react-native-maps` do internally) or a native video player SDK with hardware-accelerated decoding — both render complex, performance-sensitive native views that have no reasonable pure-JS/RN equivalent, and reimplementing their rendering in JS would be both impractical and strictly worse than using the real native view the platform (or SDK vendor) already provides.

## Related Topics
- [native-modules.md](./native-modules.md)
- [react-native-architecture.md](./react-native-architecture.md)
- [javascript-bridge-and-jsi.md](./javascript-bridge-and-jsi.md)
- [core-components.md](./core-components.md)
- [platform-specific-code.md](./platform-specific-code.md)
- [../React/refs-and-forward-ref.md](../React/refs-and-forward-ref.md)
