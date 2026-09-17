# Image and Media Handling

React Native's built-in `Image` component wraps `UIImageView` on iOS and `ImageView`/Fresco (or the newer Android image pipeline) on Android, but it gives app code very little control over caching behavior. On iOS, `Image` relies on the platform's default `NSURLCache`/`NSURLSession` HTTP caching, which respects standard cache headers but offers no way from JS to set a memory/disk cache size limit, force a cache-first vs. network-first policy, or pre-warm a cache before a screen mounts. On Android, RN's `Image` historically used Fresco with its own cache, and behavior has shifted across RN versions — the practical result is inconsistent, hard-to-reason-about caching that's a common source of bugs like images flickering/reloading on re-render, stale images persisting after a server-side image update at the same URL, or memory pressure from large images that never get evicted predictably. This is why `react-native-fast-image` (FastImage), built on SDWebImage (iOS) and Glide (Android), became a near-standard replacement for any app doing meaningful remote image work: it exposes an explicit `cache` control (`immutable`, `web`, `cacheOnly`), a `priority` prop (`low`/`normal`/`high`) to hint which images should load first when many are requested at once (e.g., an above-the-fold avatar vs. an offscreen list image), and consistent aggressive disk+memory caching behavior across both platforms.

Video playback isn't handled by any built-in RN component — `react-native-video` is the de facto standard library, wrapping `AVPlayer` on iOS and `ExoPlayer` on Android behind a single `<Video>` component with props like `source`, `paused`, `resizeMode`, `onProgress`, `onEnd`, and `repeat`. Because it's backed by native player implementations, it supports adaptive bitrate streaming (HLS/DASH), background audio, and fullscreen handling that a pure-JS or WebView-based video approach cannot deliver at acceptable performance or battery cost. Picking media from the device — photo library or camera — is likewise not a built-in RN capability; `expo-image-picker` (Expo-managed and bare-workflow compatible via config plugins) and `react-native-image-picker` (bare-workflow-first) are the two common choices, both exposing a camera path and a library path (`launchCameraAsync`/`launchImageLibraryAsync` in Expo's API, `launchCamera`/`launchImageLibrary` in `react-native-image-picker`'s). Both are tightly coupled to the platform permission system: camera access requires the `NSCameraUsageDescription` Info.plist key on iOS and the `CAMERA` runtime permission on Android, while photo library access requires `NSPhotoLibraryUsageDescription` on iOS and, on Android 13+, the more granular `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` permissions rather than the old blanket storage permission — a picker call made without the permission already granted will either prompt automatically (Expo's pickers do this) or fail silently/throw depending on the library and platform, which is a very common integration bug.

Performance for image-heavy lists comes down to three things working together. First, always request an appropriately sized image rather than a full-resolution original — most CDNs and image services (Cloudinary, Imgix, a custom resizing endpoint) support query-parameter-based resizing, so a 60×60 avatar slot should request a 60×60 (or 120×120 for 2x/3x density) image, not a 3000×3000 original that gets decoded and downscaled on-device at real memory cost. Second, `resizeMode` (`cover`, `contain`, `stretch`, `center`, `repeat`) affects both visual correctness and, indirectly, performance — `cover` and `contain` require the native layer to do scaling math, which is cheap, but requesting the wrong-shaped source image and relying on `resizeMode` to visually crop it wastes decode/memory cost that server-side resizing would avoid. Third, inside a `FlatList`, virtualization already limits how many image components are mounted at once, but you should still pair it with `getItemLayout` when row heights are fixed/predictable (avoiding an expensive per-item layout measurement pass), reasonable `windowSize`/`initialNumToRender` tuning, and — for FastImage specifically — its own priority/preload API (`FastImage.preload([...])`) to warm the cache for images just outside the current viewport before they scroll into view.

## Examples

```jsx
// RN's built-in Image: caching is opaque, this is a common flicker/reload bug
import { Image } from 'react-native';

function Avatar({ uri }) {
  // Re-renders (e.g., parent state changes unrelated to this image) can cause
  // a visible flash/reload because Image gives you no explicit cache policy control.
  return <Image source={{ uri }} style={{ width: 48, height: 48, borderRadius: 24 }} />;
}
```
This is the exact problem FastImage was built to solve — RN's `Image` has no `cache` prop, so you can't tell it "treat this URL as immutable and never re-fetch it" or "prefer the disk cache over network."

```jsx
// FastImage: explicit cache control and load priority for a list of avatars
import FastImage from 'react-native-fast-image';
import { FlatList } from 'react-native';

function UserList({ users }) {
  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item, index }) => (
        <FastImage
          style={{ width: 48, height: 48, borderRadius: 24 }}
          source={{
            uri: item.avatarUrl,
            priority: index < 5 ? FastImage.priority.high : FastImage.priority.normal,
            cache: FastImage.cacheControl.immutable, // avatar URLs never change content at the same URL
          }}
          resizeMode={FastImage.resizeMode.cover}
        />
      )}
      getItemLayout={(data, index) => ({ length: 64, offset: 64 * index, index })}
    />
  );
}
```
`priority` lets the first visible rows win the network/decode race over off-screen ones, `cache: immutable` tells FastImage it can cache aggressively without re-validating against the server, and `getItemLayout` skips the layout-measurement pass since every row is a fixed 64px tall.

```jsx
// Picking an image from camera or library with expo-image-picker, permission-aware
import * as ImagePicker from 'expo-image-picker';
import { Alert, Button } from 'react-native';

async function pickFromCamera() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Camera permission is required to take a photo.');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7, // compress before upload — full-quality camera photos are often multiple MB
    allowsEditing: true,
  });
  if (!result.canceled) {
    console.log('Captured photo URI:', result.assets[0].uri);
  }
}

function CameraButton() {
  return <Button title="Take Photo" onPress={pickFromCamera} />;
}
```
This shows the required permission-request-before-launch flow — calling `launchCameraAsync` without a granted `CAMERA` permission either auto-prompts (Expo) or fails, and `quality`/compression matters because raw camera captures can be several megabytes, which is expensive to upload and unnecessary for most UI purposes like a profile photo.

## Common Pitfalls / Gotchas

- Requesting full-resolution images for small UI slots (e.g., a 3000×3000 photo for a 60×60 avatar) instead of using a CDN/resizing service, wasting bandwidth and decode/memory cost that scales badly in scrollable lists.
- Assuming RN's built-in `Image` caches aggressively and predictably like a browser — its caching is opaque and platform-inconsistent, which is precisely the gap `react-native-fast-image` fills; relying on it for a large image-heavy feed often leads to visible re-fetch flicker.
- Forgetting platform-specific permission strings/requirements: missing `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` in iOS's Info.plist causes an instant crash (not just a denied permission) when the camera/library is invoked, and Android 13+'s granular `READ_MEDIA_IMAGES` permission is a separate declaration from the old blanket storage permission.
- Not handling the "user denies permission" and "user cancels the picker" paths distinctly — a canceled picker (`result.canceled` in Expo, or a `didCancel` flag in `react-native-image-picker`) is not an error and shouldn't be treated as a failed permission request.
- Playing video with a generic `WebView`-embedded player or trying to fake video with an `Image` GIF instead of `react-native-video` — this sacrifices adaptive streaming, hardware-accelerated decoding, and proper background/fullscreen behavior that the native player wrappers provide.
- Rendering large lists of images inside a plain `ScrollView` instead of `FlatList`/`FlashList` — without virtualization, every image mounts and decodes immediately regardless of visibility, which is a fast path to an out-of-memory crash on longer lists.
- Not compressing/resizing images picked from the camera before upload — a picker's default output can be several megabytes per photo, and uploading that directly (instead of setting `quality` or running it through a resize step) causes slow uploads and wasted server storage.

## Interview Questions & Answers

**Q: Why would you reach for `react-native-fast-image` instead of the built-in `Image` component?**
A: RN's built-in `Image` gives app code essentially no control over caching — no way to force a cache-first policy, set disk cache limits, or hint load priority — and its behavior differs across iOS and Android and across RN versions, which commonly manifests as images flickering or re-fetching unnecessarily on re-render. FastImage, built on SDWebImage and Glide, exposes explicit `cache` and `priority` props and delivers consistent aggressive caching on both platforms, which matters a lot for any screen with many remote images, like a social feed or a product grid.

**Q: What's the difference between `resizeMode` values, and how do they interact with performance?**
A: `cover` scales the image to fill its box while preserving aspect ratio (cropping overflow), `contain` scales to fit entirely within the box (letterboxing if aspect ratios differ), `stretch` ignores aspect ratio and fills the box exactly, `center` renders at natural size centered in the box, and `repeat` tiles the image. None of them fix a fundamentally oversized source image — the native layer still has to decode the full source resolution before scaling it down for display, so the real performance lever is requesting an appropriately sized image from the server/CDN, with `resizeMode` only controlling how that already-reasonably-sized image is fit into its layout box.

**Q: What permissions does picking a photo from the camera vs. the photo library require, and how do they differ across platforms?**
A: Camera capture requires `NSCameraUsageDescription` in iOS's Info.plist and the `CAMERA` runtime permission on Android; photo library access requires `NSPhotoLibraryUsageDescription` on iOS and, since Android 13 (API 33), the granular `READ_MEDIA_IMAGES`/`READ_MEDIA_VIDEO` runtime permissions rather than the old catch-all external storage permission. Missing the iOS Info.plist string causes an immediate crash when the API is invoked (not a graceful permission denial), which is a common and confusing bug for developers who only tested the Android denial path.

**Q: How do you keep a `FlatList` of images performant, and what does `getItemLayout` actually buy you?**
A: You keep it performant by requesting correctly sized images (thumbnails, not originals), relying on `FlatList`'s virtualization so only near-viewport items are mounted, tuning `windowSize`/`initialNumToRender` for the list's typical scroll behavior, and, for FastImage, using its `priority`/`preload` API to warm the cache just ahead of scroll position. `getItemLayout` lets `FlatList` skip its own layout-measurement pass by telling it upfront the exact height/offset of every row, which only works when row sizes are fixed or otherwise computable in advance without rendering — it both speeds up initial render and enables accurate `scrollToIndex` behavior.

**Q: Why is playing video through `react-native-video` preferred over other approaches, like embedding a player in a `WebView`?**
A: `react-native-video` wraps native player implementations (`AVPlayer` on iOS, `ExoPlayer` on Android), giving you hardware-accelerated decoding, adaptive bitrate streaming support (HLS/DASH), proper background-audio and fullscreen behavior, and fine-grained playback control (`paused`, `onProgress`, `onEnd`) as first-class RN props. A `WebView`-embedded player adds a whole extra browser engine's overhead just to play video, loses tight native control over playback state, and typically performs and battery-drains noticeably worse.

## Related Topics
- [flatlist-vs-scrollview-vs-sectionlist.md](./flatlist-vs-scrollview-vs-sectionlist.md)
- [core-components.md](./core-components.md)
- [app-permissions.md](./app-permissions.md)
- [performance-optimization-in-react-native.md](./performance-optimization-in-react-native.md)
- [networking-and-api-calls.md](./networking-and-api-calls.md)
- [../React/use-memo.md](../React/use-memo.md)
