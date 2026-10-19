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

Install Android Studio with the Android SDK and JDK 21, then install JavaScript dependencies:

```sh
npm ci
```

Create the release key outside the repository and keep a private backup. Android updates must use the same key and app identity:

```sh
mkdir -p "$HOME/.android"
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$HOME/.android/offline-blind-chess-release.p12" \
  -keyalg RSA -keysize 2048 -validity 10000 -alias offline-blind-chess
```

When `keytool` asks for the key password, press Enter to use the keystore password. Set the signing variables in the terminal you use for the release build. The password prompt does not echo the value:

```sh
export ANDROID_KEYSTORE_PATH="$HOME/.android/offline-blind-chess-release.p12"
export ANDROID_KEY_ALIAS="offline-blind-chess"
printf 'Keystore password: '
IFS= read -r -s ANDROID_KEYSTORE_PASSWORD
printf '\n'
export ANDROID_KEYSTORE_PASSWORD
export ANDROID_KEY_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
```

Build the first signed APK with version code `1`:

```sh
npm run android:apk -- -PversionCode=1
```

The signed APK is `android/app/build/outputs/apk/release/app-release.apk`. The `versionCode` project property defaults to `1`, so the first release can also use `npm run android:apk` without the property. For every update, use a higher version code and the same signing key. For example, build version `2` with `npm run android:apk -- -PversionCode=2`.

Keep `applicationId` in `android/app/build.gradle`, `appId` in `capacitor.config.ts`, and the local HTTPS origin in `capacitor.config.ts` unchanged. These values preserve the installed app identity and its WebView storage across updates. Gradle reads the signing key path, alias, and passwords from the terminal environment; do not put the key or passwords in the repository.

Transfer the APK to the device over USB, Quick Share, Bluetooth, or a memory card, then open it from the app you used to receive the APK.

On Android 6-7 (API 23-25), open **Settings > Security** and turn on **Unknown sources**. Install the APK, then return to **Settings > Security** and turn **Unknown sources** off.

On Android 8+ (API 26+), allow **Install unknown apps** for the app you used to open the APK. Android limits this permission to that source app. Return to the APK and confirm the install. Do not turn off other security protections. A debug APK from `npm run android:apk:debug` uses a different signing key and cannot update a release installation.

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

For the first install, keep the iPhone online and keep both terminals running. Open the `https://` URL printed by `cloudflared` in Safari, tap **Share**, then choose **Add to Home Screen**. The service worker caches the PWA after its first online visit. A Quick Tunnel URL is temporary and public to anyone who knows it; an installed PWA is tied to that URL, so install it again when the URL changes.

## Verify

```sh
npm test
npm run test:build-targets
npm run build:web
npm run build:android
```

The build-target check verifies that the PWA keeps its manifest, install UI, and service-worker registration, while the Android assets exclude browser installation UI and service-worker startup. Both builds use the same training and device-local history code.

With an emulator or device connected, `npm run android:test:device` checks the installed package identity.

### Verify an offline install and update

Use an Android 6.0 or later device or emulator. Start with a clean app installation. Uninstall an existing test copy first, or create a fresh emulator profile. Uninstalling erases that app's local test data.

1. Build the first APK with `npm run android:apk -- -PversionCode=1`, then transfer it to the device.
2. Enable airplane mode and turn off Wi-Fi. Follow the Android-version-specific permission steps above, then open the APK from the file manager and install it.
3. Launch the app while offline. Complete a Training Module Attempt and confirm that it appears in Attempt History. Force-stop and reopen the app, then confirm that the Attempt remains.
4. Build the update with the same signing key by running `npm run android:apk -- -PversionCode=2`. Transfer the new APK to the device without turning networking back on.
5. Open the new APK from the same file manager and install it over the existing app. Launch the app offline and confirm that Attempt History and Personal Best remain.

The successful in-place install verifies that the update has a higher `versionCode`, the same application identity, and a compatible signing key. Keep networking disabled through both installations and launches.

## App icons

The PWA, browser tab, and Apple home-screen icons are generated from `icon_blind.jpeg`:

```sh
npm run icons
```
