# Deep Linking

Deep linking means launching or redirecting a running app to a specific in-app screen from an external URL, rather than just opening the app to its default entry point. There are two distinct mechanisms that get lumped together under "deep linking," and interview answers that conflate them are usually incomplete: **custom URL schemes** (`myapp://profile/42`), which any app can register for itself and which any other app can also attempt to claim, and **universal links / Android App Links** (`https://myapp.com/profile/42`), which use ordinary `https` URLs but require proving domain ownership so the OS routes them to your app instead of a browser. Both require native-side configuration on top of anything you do in JS — deep linking is one of the few RN topics where the actual behavior is decided by `Info.plist`/`AndroidManifest.xml`, and React Navigation's `linking` config only handles the JS-side routing *after* the OS has already decided to hand the URL to your app.

On iOS, a custom scheme is registered via `CFBundleURLTypes` in `Info.plist` (or via Xcode's URL Types section, which edits the same plist), declaring the scheme string your app claims. Universal links instead require an `apple-app-site-association` (AASA) file hosted at `https://yourdomain.com/.well-known/apple-app-site-association`, served with no redirects and (historically) a specific content type, listing your app's Team ID + bundle identifier and which paths should route to the app; iOS fetches and caches this file when the app is installed to verify the association. On Android, a custom scheme is declared as an `<intent-filter>` inside `AndroidManifest.xml` with a `<data android:scheme="myapp" />` element; Android App Links use the same `<intent-filter>` shape but with `android:autoVerify="true"` and an `https` scheme, paired with a `assetlinks.json` file hosted at `https://yourdomain.com/.well-known/assetlinks.json` declaring your app's package name and signing certificate fingerprint, which Android verifies at install time to grant the app exclusive handling of that domain's links (rather than showing the disambiguation "open with" dialog a plain custom scheme can trigger).

Inside the app, `Linking.getInitialURL()` returns a Promise resolving to the URL that launched the app, if any — this covers the **cold start** case, where the app wasn't running and the deep link is literally what opened it. The **warm start** case — the app already running in the background or foreground and receiving a new deep link — is handled separately via `Linking.addEventListener('url', ({ url }) => { ... })`, which returns a subscription object that must be cleaned up with `.remove()` (older RN versions used `Linking.removeEventListener`, which is deprecated in favor of the subscription-based API). Missing either half of this pair is the single most common deep-linking bug: an app that only handles `getInitialURL` will silently ignore deep links tapped while it's already open, and one that only listens for the `url` event will fail to route correctly when the app is launched fresh from a link.

React Navigation's `linking` prop, passed to `NavigationContainer`, wraps both of these APIs for you: `prefixes` lists the schemes/domains to recognize (`['myapp://', 'https://myapp.com']`), and `config.screens` maps route names to URL path patterns, including dynamic segments (`Profile: 'profile/:userId'`) that populate `route.params` automatically. Given that config, React Navigation itself calls `getInitialURL` and subscribes to the `url` event internally, parses matching URLs, and dispatches the equivalent navigation action — you generally don't need to touch the raw `Linking` API yourself once `linking` is configured, except for advanced cases like custom URL parsing logic via the `getStateFromPath`/`getPathFromState` config options. Testing deep links during development is done without needing a real referring app: `npx uri-scheme open myapp://profile/42 --ios` (or `--android`) launches a custom scheme on a simulator/emulator via the `uri-scheme` CLI package, while `adb shell am start -W -a android.intent.action.VIEW -d "myapp://profile/42" com.yourapp.package` does the same directly through ADB on Android, and is also the standard way to test that App Links verification and routing behave correctly on a real or emulated Android device.

## Examples

```xml
<!-- iOS: Info.plist — registering a custom URL scheme -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

```xml
<!-- Android: AndroidManifest.xml — custom scheme + App Link intent filters -->
<activity android:name=".MainActivity" android:exported="true">
  <!-- Custom scheme (myapp://...) -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" />
  </intent-filter>

  <!-- Android App Link (https://myapp.com/...) — requires assetlinks.json verification -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="myapp.com" />
  </intent-filter>
</activity>
```

`android:autoVerify="true"` is what triggers Android to check `assetlinks.json` against this app's signing certificate at install time; without it, `https://myapp.com/...` links open in the browser (or prompt a disambiguation dialog) instead of going straight to the app.

```jsx
// Handling both cold-start and warm-start deep links manually with Linking
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';

function useDeepLinkHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    function routeFromUrl(url) {
      const match = url.match(/profile\/(\w+)/);
      if (match) navigation.navigate('Profile', { userId: match[1] });
    }

    // Cold start: app was launched BY this URL
    Linking.getInitialURL().then((url) => {
      if (url) routeFromUrl(url);
    });

    // Warm start: app was already running when the URL arrived
    const subscription = Linking.addEventListener('url', ({ url }) => routeFromUrl(url));

    return () => subscription.remove(); // must clean up, or listeners leak across remounts
  }, [navigation]);
}
```

This is exactly the pair of cases React Navigation's `linking` prop handles for you internally — this manual version is what you'd fall back to only if you needed custom parsing logic outside what `config.screens` path patterns can express.

```jsx
// React Navigation's linking config, doing the same job declaratively
const linking = {
  prefixes: ['myapp://', 'https://myapp.com', 'https://www.myapp.com'],
  config: {
    screens: {
      HomeTab: {
        screens: {
          Feed: 'home',
          PostDetail: 'post/:postId',
        },
      },
      Profile: 'profile/:userId',
    },
  },
};

// <NavigationContainer linking={linking} fallback={<LoadingScreen />}>...</NavigationContainer>
```

Note the nested `screens` object under `HomeTab` — the path config's shape has to mirror the actual navigator nesting (a stack nested inside a tab), or React Navigation won't be able to resolve `post/:postId` to the correctly nested screen.

## Common Pitfalls / Gotchas

- Handling only `Linking.getInitialURL()` (cold start) or only the `url` event listener (warm start), not both — the two cover mutually exclusive launch scenarios, and an app tested only by force-quitting and reopening via a link will look correct while silently failing to handle links tapped while already running, or vice versa.
- Forgetting to call `.remove()` on the subscription returned by `Linking.addEventListener('url', ...)` — this leaks a listener on every remount of the component that registered it, and over time can cause a single incoming URL to be handled (and navigated to) multiple times.
- Assuming a custom URL scheme is as trustworthy or exclusive as a universal/App Link — any other app can register the same custom scheme, creating ambiguity about which app actually opens it, and there's no domain-ownership verification step the way there is for AASA/`assetlinks.json`; sensitive flows (like OAuth redirects) generally should not rely on a custom scheme alone for security.
- Hosting `apple-app-site-association` or `assetlinks.json` behind a redirect, with the wrong content type, or not at the exact `.well-known/` path — both iOS and Android fetch these files with strict expectations (no redirects, reachable over plain HTTPS), and a misconfigured host silently breaks universal link / App Link verification with no error surfaced in the app itself.
- Omitting `android:autoVerify="true"` on the App Links `<intent-filter>`, or mismatching the signing certificate fingerprint in `assetlinks.json` against the actual app signing key (especially the difference between a debug and release keystore) — either mistake causes Android to fall back to showing a disambiguation dialog or opening the link in a browser instead of the app.
- Writing a `config.screens` path map whose structure doesn't mirror the actual nested navigator hierarchy (flat keys for a screen that's actually nested two navigators deep) — React Navigation fails to resolve the path to the right screen, and the deep link either does nothing or lands on the wrong/default screen with no explicit error.

## Interview Questions & Answers

**Q: What's the practical difference between a custom URL scheme and a universal link / Android App Link?**
A: A custom scheme (`myapp://...`) is self-registered by the app with no ownership verification — any app can claim the same scheme string, which can create ambiguity about which app handles it, and it's not something a plain web link (`<a href>`) can reliably trigger without special handling. Universal links (iOS) and App Links (Android) instead use ordinary `https://` URLs, but require hosting a verification file (`apple-app-site-association` or `assetlinks.json`) proving you control the domain; once verified, the OS routes matching links directly to the app instead of the browser, and the same link degrades gracefully to opening in a browser if the app isn't installed.

**Q: Why do you need to handle both `Linking.getInitialURL()` and the `Linking.addEventListener('url', ...)` event, instead of just one?**
A: They cover two different launch states that can't be detected the same way. `getInitialURL()` answers "was this app cold-launched by a URL?" — it's only meaningful once, at startup, for the specific case where the OS started the app process itself because of the link. The `url` event instead fires while the app is already running (foreground or backgrounded) and a new deep link arrives; `getInitialURL()` won't fire again in that case because the app wasn't relaunched. An app that only implements one half correctly handles roughly half of all real-world deep-link scenarios and silently drops the rest.

**Q: How would you test a deep link during development without a real referring app or web page?**
A: On iOS, `npx uri-scheme open myapp://profile/42 --ios` launches the simulator with that URL as if a real link had opened the app. On Android, `adb shell am start -W -a android.intent.action.VIEW -d "myapp://profile/42" com.yourapp.package` does the equivalent via ADB, and is also the standard way to confirm that a real `https://` App Link is correctly verified and routes to the app rather than the browser, since it exercises the actual OS intent-resolution path rather than just the app's internal URL-parsing logic.

**Q: How does React Navigation's `linking` config relate to the native-side URL scheme/App Link setup — does configuring `linking` alone make deep linking work?**
A: No. The `linking` prop's `prefixes` and `config.screens` only control what happens *inside* the app once the OS has already decided to hand a matching URL to it — parsing the URL and mapping it to a navigation action. The OS-level decision to route a given URL to your app at all is controlled entirely by native configuration: `CFBundleURLTypes` in `Info.plist` for iOS custom schemes, the AASA file for universal links, and `<intent-filter>` entries plus `assetlinks.json` for Android. Skipping the native configuration means the app never receives the URL in the first place, regardless of how correctly `linking` is configured.

**Q: What goes wrong if `assetlinks.json` lists the wrong signing certificate fingerprint?**
A: Android App Links verification fails silently from the user's perspective — tapping an `https://yourdomain.com/...` link either opens a browser or shows the "open with" disambiguation dialog instead of launching straight into the app, even though the `<intent-filter>` and `autoVerify="true"` are configured correctly. This commonly happens when `assetlinks.json` is generated with the debug keystore's SHA-256 fingerprint but the released app is signed with a different (release or Play App Signing) key — the two need to match the certificate that actually signs the installed APK/AAB for verification to succeed.

## Related Topics
- [navigation.md](./navigation.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [security-in-react-native.md](./security-in-react-native.md)
- [building-and-release.md](./building-and-release.md)
- [app-permissions.md](./app-permissions.md)
- [../React/use-effect.md](../React/use-effect.md)
