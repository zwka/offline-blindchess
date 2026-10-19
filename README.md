# Offline Blind Chess

Offline Blind Chess provides a browser PWA for Apple devices and an offline-installable Android app, with Square Colors, Same Color, Coordinates, and on-device attempt history.

Choose a drill to open its first question. The clock stays at 60 seconds until you answer. Your first answer starts the clock and counts toward the attempt.

When time runs out, Results shows the final score, accuracy, answer count, and personal best for that drill. Select **History** to open that drill's attempt history.

## Play Square Colors

Each attempt lasts 60 seconds. Identify a square as Light or Dark. Every correct answer adds one point, and the results show your score, answer count, and accuracy.

Choose **Light** with the left arrow button or left arrow key. Choose **Dark** with the right arrow button or right arrow key. The app pauses the timer when you switch away and resumes when you return. Closing the app before the attempt ends discards that attempt.

## Play Same Color

Each attempt lasts 60 seconds. Decide whether two square coordinates have the same board color. Two squares match when their file-plus-rank totals have the same parity. Each correct answer adds one point.

Choose **Different** with the left arrow button or left arrow key. Choose **Same** with the right arrow button or right arrow key. The app pauses the timer when you switch away and resumes when you return. Closing the app before the attempt ends discards that attempt.

## Play Coordinates

Each attempt lasts 60 seconds. A square coordinate appears above an unlabeled chessboard. Tap or click the matching square. The board uses the standard orientation, with a1 at the bottom left and h8 at the top right. A wrong selection counts as an answer and reveals the target square.

## Review attempts

Completed attempts from all drills stay in this browser on this device. Open **History** and choose a drill to review its attempts and personal best. Each history tab shows only that drill's scores. Clearing history removes all saved attempts, and clearing this browser's site data also removes them.

## Run locally

```sh
npm install
npm run dev
```

## Install on Android

The Android app bundles the production web assets in a Capacitor shell. It launches without a network connection, and its Attempt History remains in the app's local WebView storage. Android 6.0 (API 23) or newer is required.

Install Android Studio with the Android SDK and JDK 21, then install JavaScript dependencies and build the APK:

```sh
npm install
npm run android:apk
```

Release APKs require a signing key. Create it outside the repository and keep a backup; every update must use this same key and app identity:

```sh
keytool -genkeypair -v -keystore "$HOME/offline-blind-chess-release.jks" \
  -keyalg RSA -keysize 2048 -validity 10000 -alias offline-blind-chess
export ANDROID_KEYSTORE_PATH="$HOME/offline-blind-chess-release.jks"
export ANDROID_KEY_ALIAS="offline-blind-chess"
export ANDROID_KEYSTORE_PASSWORD="..."
export ANDROID_KEY_PASSWORD="..."
npm run android:apk
```

The signed APK is `android/app/build/outputs/apk/release/app-release.apk`. Transfer it to the device over USB, Bluetooth, or another local method, then open it from the device's file manager. If Android asks, allow the file manager to install unknown apps for this installation. This grants permission to that source; do not disable device-wide security protections. For a temporary development build, `npm run android:apk:debug` produces a debug-signed APK that cannot update a release-signed installation.

Keep `applicationId` in `android/app/build.gradle` and `appId` in `capacitor.config.ts` unchanged. Increase `versionCode` in `android/app/build.gradle` for every release. Keep the local HTTPS origin in `capacitor.config.ts` stable so WebView storage remains available across updates.

## Install the Apple PWA

Apple devices continue to use the browser PWA served over HTTPS. Install [`cloudflared`](https://developers.cloudflare.com/tunnel/downloads/) first. On macOS with Homebrew, run `brew install cloudflared`.

Build the PWA, then start the preview server in one terminal:

```sh
npm install
npm run build:web
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Start the tunnel in a second terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost
```

Open the `https://` URL printed by `cloudflared` on the iPhone in Safari, tap **Share**, then choose **Add to Home Screen**. Keep both terminals open while installing or using the app online. The service worker caches the PWA after its first online visit. A Quick Tunnel URL is temporary and public to anyone who knows it; an installed PWA is tied to that URL, so install it again when the URL changes.

## Verify

```sh
npm test
npm run test:build-targets
npm run build:web
npm run build:android
```

The build-target check verifies that the PWA keeps its manifest, install UI, and service-worker registration, while the Android assets exclude browser installation UI and service-worker startup. Both builds use the same training and device-local history code.

With an emulator or device connected, `npm run android:test:device` checks the installed package identity. Also install the release APK with networking disabled, complete each drill, confirm Score and Accuracy and saved history, force-stop and relaunch, then install a newer signed APK over it to verify history survives updates.

## App icons

The PWA, browser tab, and Apple home-screen icons are generated from `icon_blind.jpeg`:

```sh
npm run icons
```
