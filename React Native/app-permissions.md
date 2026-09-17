# App Permissions

Requesting device permissions (camera, location, contacts, notifications, photo library, microphone, etc.) in React Native requires satisfying two independent layers: the native platform's own permission model, and a JS-side API to check/request against it. Getting only one right isn't enough — the app can crash outright (iOS) or the permission dialog can silently fail to appear (Android) if the native layer isn't configured, regardless of how correct the JS request logic is.

On **iOS**, every permission the app might request must have a corresponding "usage description" string declared in `Info.plist` *before* the app ever calls the API that would trigger the system prompt — `NSCameraUsageDescription` for the camera, `NSLocationWhenInUseUsageDescription`/`NSLocationAlwaysAndWhenInUseUsageDescription` for location, `NSPhotoLibraryUsageDescription` for the photo library, `NSMicrophoneUsageDescription` for audio, and so on. This string is what's shown to the user in the system permission dialog explaining *why* the app wants access. If the corresponding key is missing and the app tries to trigger that permission's native API, iOS doesn't just deny the permission — it **crashes the app** (a `NSInternalInconsistencyException` or similar), which is a distinctly nasty failure mode to debug if you're not aware of the requirement, since it can look like an unrelated native-module crash.

On **Android**, "dangerous" permissions (camera, location, contacts, storage, microphone, etc. — as opposed to "normal" permissions like internet access, which are granted automatically at install time) must be declared in `AndroidManifest.xml` *and* requested at runtime via `PermissionsAndroid.request()` (or, more commonly in modern RN code, through `react-native-permissions`, which wraps this). Unlike iOS's single "ask once, get an answer" flow, Android's runtime model has more states to handle: granted, denied (can ask again), and — since Android 11 (API 30) — a "permanently denied" state that kicks in after the user denies a permission twice (or unchecks "ask again"), after which calling `request()` again returns denied immediately without ever showing a dialog, silently, with no way to re-prompt in-app.

`react-native-permissions` is the standard cross-platform abstraction over both native models: `check(permission)` reads current status without prompting, `request(permission)` triggers the native prompt (or reads status directly if already decided), and permissions are referenced via platform-specific constants — `PERMISSIONS.IOS.CAMERA`, `PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION`, etc. — so the same call-site logic branches on the returned `RESULTS` enum (`UNAVAILABLE`, `DENIED`, `LIMITED`, `GRANTED`, `BLOCKED`) rather than on ad hoc platform checks. `BLOCKED` specifically maps to that permanently-denied Android state (and the iOS equivalent, where a user previously denied and the OS won't re-show the system prompt) — the only recovery from `BLOCKED` is directing the user to the OS settings screen for the app, via `Linking.openSettings()`, since no in-app dialog can re-trigger the OS-level prompt once it's been permanently dismissed.

The best-practice **timing** for permission requests is contextual, not eager: request a permission at the moment the user takes an action that needs it (tapping "Add Photo" triggers the photo-library prompt; tapping "Use My Location" triggers the location prompt) rather than requesting a batch of permissions on app launch before the user has any context for why they're being asked. Requesting on launch — a pattern common in poorly-designed apps — measurably increases denial rates, because users reflexively deny prompts they don't yet understand the purpose of, and a denial (especially one that becomes permanently blocked after a second ask) is much harder to recover from than delaying the ask until the user's intent makes the request self-explanatory.

## Examples

```jsx
// react-native-permissions: check, then request only when needed, with full RESULTS handling
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform, Linking, Alert } from 'react-native';

const CAMERA_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.CAMERA,
  android: PERMISSIONS.ANDROID.CAMERA,
});

async function ensureCameraPermission() {
  const status = await check(CAMERA_PERMISSION);

  switch (status) {
    case RESULTS.GRANTED:
      return true;

    case RESULTS.DENIED: {
      // Not yet asked, or asked once and can ask again — safe to prompt
      const result = await request(CAMERA_PERMISSION);
      return result === RESULTS.GRANTED;
    }

    case RESULTS.BLOCKED:
      // Permanently denied — no in-app dialog can re-trigger the OS prompt
      Alert.alert(
        'Camera access needed',
        'Enable camera access in Settings to take photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;

    case RESULTS.UNAVAILABLE:
      // Feature not present on this device (e.g., no camera hardware)
      return false;

    default:
      return false;
  }
}
```

This is the full decision tree a real permission flow needs: `check` first (never blindly `request`, since re-requesting a `BLOCKED` permission just silently fails), and `BLOCKED` specifically routes the user to `Linking.openSettings()` since that's the only way to recover from a permanently-denied state.

```jsx
// Requesting in context (on user action), not eagerly on app launch
import { View, Button, Image } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useState } from 'react';

function AddPhotoButton() {
  const [photoUri, setPhotoUri] = useState(null);

  const handleAddPhoto = async () => {
    // Permission is requested right here, at the moment of clear user intent —
    // not in a useEffect on mount, which would prompt before the user knows why
    const granted = await ensureCameraPermission();
    if (!granted) return;

    const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
    if (!result.didCancel && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  return (
    <View>
      <Button title="Add Photo" onPress={handleAddPhoto} />
      {photoUri && <Image source={{ uri: photoUri }} style={{ width: 100, height: 100 }} />}
    </View>
  );
}
```

Tying the permission request to the "Add Photo" button press, rather than requesting camera access when the screen first mounts, gives the user context for the prompt and measurably improves grant rates.

```xml
<!-- iOS: Info.plist usage-description keys — required before the corresponding -->
<!-- native API is ever called, or the app crashes outright -->
<key>NSCameraUsageDescription</key>
<string>We use your camera so you can attach photos to your posts.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show nearby listings.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library so you can choose a profile picture.</string>
```

```xml
<!-- Android: manifest declarations are required in addition to the runtime request -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

Both platforms need their native declaration present before any JS-side `check`/`request` call can meaningfully succeed — on iOS a missing `Info.plist` key crashes the app the moment the corresponding API is invoked; on Android a missing manifest entry means `PermissionsAndroid.request()`/`react-native-permissions`'s `request()` will not surface a system dialog at all.

## Common Pitfalls / Gotchas

- Forgetting the `Info.plist` usage-description key for a permission (e.g., `NSCameraUsageDescription`) — this doesn't just deny the permission, it **crashes the app** the instant the corresponding native API is called, which is easy to misdiagnose as an unrelated native crash.
- Calling `request()` again after a permission is `BLOCKED` (permanently denied) and expecting the OS dialog to reappear — it won't; the only recovery is `Linking.openSettings()` directing the user to manually re-enable it.
- Requesting every permission the app might ever need in a batch on first launch, instead of contextually when the user takes an action that needs it — this measurably increases denial (and permanent-denial) rates since users lack context for why they're being asked.
- Treating iOS and Android permission flows as identical — iOS shows one system prompt and the result is effectively final per-install (short of the user manually changing it in Settings), while Android's "deny twice → permanently blocked" state, and the general concept of re-askable `DENIED` vs. terminal `BLOCKED`, has no exact iOS equivalent in the same shape.
- Not handling `RESULTS.UNAVAILABLE` — a permission can be unavailable on a given device or OS version (e.g., no camera hardware, or a feature gated behind a newer OS version than the device runs), which is distinct from the user denying it and shouldn't be treated the same way in UI messaging.
- Checking permission status once on mount and caching it in state for the app's lifetime — a user can background the app, change the permission in system Settings, and return; state that isn't re-checked (e.g., on `AppState` becoming `active` again) can go stale.

## Interview Questions & Answers

**Q: What happens on iOS if you request camera access without declaring `NSCameraUsageDescription` in Info.plist?**
A: The app crashes — iOS requires the usage-description string to exist before the corresponding permission-triggering API is ever called, and calling it without that key throws an uncaught native exception that terminates the app rather than gracefully denying the permission. This is a common gotcha because the crash can look unrelated to permissions at first glance, especially if a third-party library is the one internally triggering the camera API.

**Q: What does it mean for an Android permission to be "permanently denied," and how do you recover from it?**
A: On Android, if a user denies a dangerous permission (like camera or location) twice, or denies it once while unchecking "don't ask again," the OS stops showing the system permission dialog entirely for future `request()` calls — they resolve to denied immediately and silently, with no prompt shown at all. `react-native-permissions` surfaces this as the `BLOCKED` result, and the only way to recover is to direct the user out of the app to the system Settings screen for your app via `Linking.openSettings()`, where they can manually re-enable the permission.

**Q: Why is it considered bad practice to request all needed permissions on app launch?**
A: A permission prompt shown without context — before the user has taken an action that makes the need for it obvious — gets denied at a much higher rate, because users are reflexively cautious about prompts they don't understand the purpose of. Since a denial (especially a second one, which can permanently block the permission on Android) is significantly harder to recover from than simply delaying the request, best practice is to request each permission right at the moment the user does something that requires it — tapping a "Scan QR Code" button triggers the camera prompt, not app launch.

**Q: How does `react-native-permissions`'s `check` differ from `request`, and why would you call `check` first?**
A: `check(permission)` reads the current permission status without showing any UI or triggering a system prompt, while `request(permission)` will show the native permission dialog if the status is askable (`DENIED`, not yet decided). You call `check` first because blindly calling `request` on a permission that's already `BLOCKED` won't show a dialog anyway (it just silently resolves to `BLOCKED` again) — checking first lets you branch straight to a "please enable this in Settings" UI instead of wasting a call that can never succeed, and also avoids re-prompting a user who already granted the permission.

**Q: How do you handle the case where a user denies a permission your app genuinely needs, like location for a maps feature?**
A: First check whether the status is `DENIED` (re-askable) or `BLOCKED` (permanently denied) — for `DENIED`, you can show your own explanatory UI and offer to trigger `request()` again; for `BLOCKED`, the system prompt can't be re-shown, so you present a message explaining what's needed and a button that calls `Linking.openSettings()` to send the user to the app's OS settings page where they can toggle it manually. In both cases the app should degrade gracefully rather than being unusable — for a maps feature, that might mean falling back to a manual address search instead of blocking the whole screen.

## Related Topics
- [security-in-react-native.md](./security-in-react-native.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [image-and-media-handling.md](./image-and-media-handling.md)
- [push-notifications.md](./push-notifications.md)
- [platform-specific-code.md](./platform-specific-code.md)
- [deep-linking.md](./deep-linking.md)
