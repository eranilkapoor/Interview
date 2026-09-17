# Push Notifications

Push notifications in React Native rest on two separate platform-level transport mechanisms that your JS code never talks to directly: **APNs** (Apple Push Notification service) on iOS and **FCM** (Firebase Cloud Messaging) on Android. Both work the same way at a high level — your app registers with the OS to get a unique device token, your backend sends that token plus a payload to APNs/FCM, and the OS-level push service delivers and wakes the app (or just shows a system notification) even when your app process isn't running. Historically Android had its own predecessor to FCM (GCM), and iOS has no alternative to APNs at all — any push notification reaching an iOS device, even one routed through Firebase, ultimately transits through APNs, because only Apple's own infrastructure can wake an iOS app or post to its notification center.

Because RN doesn't bundle push notification support out of the box, you reach for a JS-side library that wraps the platform SDKs: `@react-native-firebase/messaging` is the most common choice (wrapping FCM directly for Android, and Firebase's APNs bridge for iOS), `notifee` is frequently paired with it specifically for rich local/foreground notification *display* control (custom channels, actions, styling) that `@react-native-firebase/messaging` alone doesn't provide, and `expo-notifications` is the Expo-ecosystem equivalent, handling both remote push registration and local notification scheduling with a more unified API. A critical distinction across all of them: registering for push and *receiving a token* requires explicit user permission, and the permission model differs meaningfully by platform. On iOS, calling `messaging().requestPermission()` (or the equivalent) triggers the native system permission dialog and is **mandatory and user-facing** — there is no way to receive remote notifications without the user explicitly granting permission through this OS dialog, and it can only be shown once automatically (a denied prompt requires the user to go into Settings manually to re-enable). On Android, prior to API 33 (Android 13), notification permission was granted implicitly at install time; from Android 13 onward, apps must request the new runtime `POST_NOTIFICATIONS` permission explicitly, the same way they'd request camera or location — a change that catches many apps upgrading their target SDK version off guard, since notifications that "just worked" on older Android versions silently stop appearing until the new permission is requested and granted.

Handling notifications differs substantially depending on the app's execution state at delivery time, and this is one of the most commonly tested areas in interviews because it trips up real implementations constantly. In the **foreground**, the OS does not automatically show a system notification banner by default on either platform when your app is the active, visible app — instead your JS code receives an `onMessage` event (Firebase) and is responsible for deciding what to do, typically showing an in-app banner/toast or using a library like `notifee` to explicitly display a local notification, since a "foreground-only" push otherwise happens silently with no visual indication. In the **background** (app suspended but process alive), the OS handles displaying the system notification UI automatically, but your JS code can still respond via a background handler (`setBackgroundMessageHandler` in Firebase) to do work like updating a badge count or pre-fetching data, with real constraints — background execution time is limited by the OS and the handler must complete quickly. In the **killed** state (process fully terminated), there is no JS runtime available to run any handler at delivery time; the OS displays the notification purely from the payload, and your app only gets a chance to run JS code again when the user taps the notification, which relaunches the app and lets you read the notification's data from a "getInitialNotification"-style API to know it was a cold start triggered by a tap rather than a normal launch.

Tapping a notification to navigate to a specific screen — "deep-link-on-tap" — relies on attaching a custom `data` payload to the notification server-side (e.g., `{ type: 'order_detail', orderId: '123' }`) and reading it back in JS via the library's tap-event handler (`onNotificationOpenedApp` for background-tap, `getInitialNotification`/`getInitialMessage` for killed-state-tap), then imperatively navigating with your navigation library's ref-based API (since the tap can happen before your navigator has even mounted its normal navigation context). This is functionally the same problem as [deep-linking.md](./deep-linking.md) solves for URL-based links, just triggered by a notification tap instead of a URL scheme/universal link, and the two are often implemented together so a single "resolve this data payload to a screen + params" function serves both entry points.

## Examples

```jsx
// Requesting permission and registering the FCM token (iOS mandatory prompt, Android 13+ runtime permission)
import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';

async function registerForPushNotifications() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    // Android 13+ requires this explicit runtime permission — it did not exist before API 33
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }

  // iOS: mandatory, user-facing system dialog — no token without this
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log('Push permission denied — cannot register for remote notifications');
    return null;
  }

  const token = await messaging().getToken();
  // Send this token to your backend so it can target this specific device
  return token;
}
```
This shows the platform split explicitly: Android's runtime permission is a new, separate ask on API 33+, while iOS's `requestPermission()` has always been the mandatory gate — skipping either means `getToken()` either throws or returns a token the OS will never actually deliver to.

```jsx
// Foreground vs background vs killed-state handling with Firebase Messaging
import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

function usePushNotificationHandlers(navigationRef) {
  useEffect(() => {
    // FOREGROUND: no system banner shown automatically — you must display one yourself
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      await notifee.displayNotification({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        android: { channelId: 'default' },
      });
    });

    // BACKGROUND TAP: app was backgrounded, not killed, user tapped the system notification
    const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      navigateFromPushData(navigationRef, remoteMessage.data);
    });

    // KILLED STATE: app was fully terminated, tap on the notification relaunched it
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          navigateFromPushData(navigationRef, remoteMessage.data);
        }
      });

    return () => unsubscribeForeground();
    // Note: onNotificationOpenedApp's unsubscribe is omitted here for brevity but should be cleaned up too
  }, [navigationRef]);
}

function navigateFromPushData(navigationRef, data) {
  if (data?.type === 'order_detail' && data?.orderId) {
    navigationRef.current?.navigate('OrderDetail', { orderId: data.orderId });
  }
}

// This must be registered OUTSIDE the component tree, at the top level (e.g., index.js),
// because a killed-state message has no mounted React tree to run inside yet.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('Background message handled silently:', remoteMessage.data);
});
```
This demonstrates the three distinct execution states in one place: `onMessage` for foreground (where you must manually display something), `onNotificationOpenedApp` for a tap while backgrounded, and `getInitialNotification` for a tap that relaunched a killed app — the last of which is the one developers most often forget, leading to "deep link works from background but not from a cold start" bugs.

```jsx
// expo-notifications equivalent: permission request + tap-based navigation
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, // Expo's API lets you opt into showing a banner in foreground
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function usePushSetup(navigationRef) {
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      // send `token` to backend
    })();

    const tapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.orderId) {
        navigationRef.current?.navigate('OrderDetail', { orderId: data.orderId });
      }
    });

    return () => tapSubscription.remove();
  }, [navigationRef]);
}
```
Expo's `setNotificationHandler` is a useful contrast to raw Firebase: it lets you declaratively opt into showing a system banner even while the app is foregrounded, rather than requiring you to manually call a display function like the `notifee` example above.

## Common Pitfalls / Gotchas

- Assuming a foreground push will show a system banner automatically the same way a background one does — on both iOS and Android, by default, your app is responsible for displaying something in the foreground (`onMessage`/a foreground handler); doing nothing means the push arrives with zero visible indication.
- Forgetting Android 13+'s `POST_NOTIFICATIONS` runtime permission when raising `targetSdkVersion` — an app that worked fine on notifications for years can silently stop delivering them after a routine SDK bump, because the permission is now required and not implicitly granted.
- Only handling `onNotificationOpenedApp` (background tap) and forgetting `getInitialNotification`/`getInitialMessage` (killed-state tap) — this is the single most common bug in push-based deep linking: it works when testing from a backgrounded app but silently fails to navigate anywhere when the app was fully closed and the notification tap cold-starts it.
- Registering `setBackgroundMessageHandler` inside a React component instead of at the top level of the entry file — background/killed-state delivery can invoke this handler without any React tree mounted, so component-scoped registration simply never runs for those cases.
- Treating the iOS permission prompt as re-promptable — once a user denies it, calling `requestPermission()` again does not show the system dialog a second time; the only recovery path is directing the user to the app's Settings page to toggle it manually.
- Not distinguishing `notification` payload vs. `data` payload in the message — a pure "notification" payload can be displayed by the OS automatically in background/killed states without any app code running, while a "data-only" payload requires your background handler to construct and display the notification yourself, and mixing up which fields are used for navigation data vs. display text is a frequent source of "the tap doesn't navigate correctly" bugs.

## Interview Questions & Answers

**Q: What's the difference between APNs and FCM, and does using FCM mean you avoid APNs entirely on iOS?**
A: APNs is Apple's push transport, exclusive to iOS/macOS, and FCM is Google's, primarily used for Android (and web). No — even when a cross-platform push service like Firebase is used for iOS, Firebase's iOS delivery still routes through APNs under the hood, because only Apple's own infrastructure is allowed to wake an iOS app or post to its notification center; FCM on iOS is essentially a convenience layer sitting in front of APNs, not a replacement for it.

**Q: Why doesn't a foreground push notification show a banner by default, and how do you fix that?**
A: The OS assumes that if your app is actively in the foreground, you probably want to handle the incoming message yourself rather than interrupting the user with a system banner they're already looking at your app during. You fix it by listening for the foreground message event (`messaging().onMessage` in Firebase, or configuring `setNotificationHandler` with `shouldShowAlert: true` in Expo) and either showing your own in-app UI or explicitly triggering a local notification display via a library like `notifee`.

**Q: How does handling a notification differ between the app being backgrounded versus fully killed?**
A: When backgrounded, the app's process is still alive, so a background message handler can run (with limited execution time) even before any user interaction, and a tap is caught via a background-tap listener. When fully killed, there's no JS runtime at delivery time at all — the OS displays the notification purely from its payload with zero app code involved — and your app only gets a chance to react when the user taps it, which cold-starts the app; you read that as an "initial notification" via an API like `getInitialNotification()` specifically because a normal event listener wouldn't have been registered yet to catch it.

**Q: How do you implement deep-linking from a notification tap to a specific in-app screen?**
A: You attach a structured `data` payload to the notification server-side (e.g., a screen name and the ID it needs), then in JS you register tap handlers for each possible execution state — `onNotificationOpenedApp` for background taps and `getInitialNotification` for killed-state taps in Firebase, or a unified response listener in Expo — and route the `data` payload through a shared resolver function that calls your navigation library's ref-based `navigate()`, since the tap may occur before the app's normal navigator context has mounted.

**Q: What changed with notification permissions on Android 13, and why does it matter for existing apps?**
A: Before Android 13 (API 33), notification permission was effectively granted automatically at install time — there was no runtime prompt. Starting with Android 13, apps must explicitly request the new `POST_NOTIFICATIONS` runtime permission, exactly like camera or location permissions, and it must be requested by app code. This matters because simply bumping an app's `targetSdkVersion` to 33+ without adding this permission request causes notifications to silently stop being delivered on new installs, since the permission is no longer implicitly granted.

## Related Topics
- [app-permissions.md](./app-permissions.md)
- [deep-linking.md](./deep-linking.md)
- [navigation.md](./navigation.md)
- [app-state-and-lifecycle.md](./app-state-and-lifecycle.md)
- [async-storage.md](./async-storage.md)
- [../React/use-effect.md](../React/use-effect.md)
