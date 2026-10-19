# Offline Blind Chess

An installable, offline-first chess-training PWA with six drills.

Practice Square Colors, Same Color, Coordinates, Diagonals, Quadrant, and Knight. The app saves attempt history on this device and supports System, Light, and Dark themes.

Choose a drill to open its first question. The clock stays at 60 seconds until you answer. Your first answer starts the clock and counts toward the attempt.

When time runs out, Results shows the final score, accuracy, answer count, and personal best for that drill. Select **History** to open that drill's attempt history.

## Choose a theme

Choose **System**, **Light**, or **Dark** in the header. System follows your device setting. The app remembers your choice in this browser on this device.

## Play Square Colors

Each attempt lasts 60 seconds. Identify a square as Light or Dark. Every correct answer adds one point, and the results show your score, answer count, and accuracy.

Choose **Light** with the left arrow button or left arrow key. Choose **Dark** with the right arrow button or right arrow key. The app pauses the timer when you switch away and resumes when you return. Closing the app before the attempt ends discards that attempt.

## Play Same Color

Each attempt lasts 60 seconds. Decide whether two square coordinates have the same board color. Two squares match when their file-plus-rank totals have the same parity. Each correct answer adds one point.

Choose **Different** with the left arrow button or left arrow key. Choose **Same** with the right arrow button or right arrow key. The app pauses the timer when you switch away and resumes when you return. Closing the app before the attempt ends discards that attempt.

## Play Coordinates

Each attempt lasts 60 seconds. A square coordinate appears above an unlabeled chessboard. Tap or click the matching square. The board uses the standard orientation, with a1 at the bottom left and h8 at the top right. A wrong selection counts as an answer and reveals the target square.

## Play Diagonals

Each attempt lasts 60 seconds. Decide whether two square coordinates lie on the same diagonal. Prompts with and without a shared diagonal occur equally often. Choose **Different** with the left arrow button or left arrow key. Choose **Same** with the right arrow button or right arrow key.

## Play Quadrant

Each attempt lasts 60 seconds. Identify which quadrant contains the shown square coordinate by clicking **Quadrant 1**, **Quadrant 2**, **Quadrant 3**, or **Quadrant 4**. The board uses the standard orientation.

- Quadrant 1 contains files a-d and ranks 5-8.
- Quadrant 2 contains files e-h and ranks 5-8.
- Quadrant 3 contains files a-d and ranks 1-4.
- Quadrant 4 contains files e-h and ranks 1-4.

The rule dialog shows the same map. Practice one quadrant range at a time.

## Play Knight

Each attempt lasts 60 seconds. Decide whether a knight can move between two square coordinates in one move. The file and rank distances must be one and two, in either order. The drill samples valid and invalid pairs equally, and every pair uses two distinct squares.

Choose **No** with the left arrow button or left arrow key. Choose **Yes** with the right arrow button or right arrow key. The rule dialog explains the L-shaped move.

## Review attempts

Completed attempts from all drills stay in this browser on this device. Open **History** and choose a drill to review its attempts and personal best. Each history tab shows only that drill's scores. Clearing history removes all saved attempts, and clearing this browser's site data also removes them.

## Run locally

```sh
npm install
npm run dev
```

## Install on a mobile device

Use a Cloudflare Quick Tunnel to open the production build on a phone over HTTPS. Install [`cloudflared`](https://developers.cloudflare.com/tunnel/downloads/) first. On macOS with Homebrew, run `brew install cloudflared`.

Build the app, then start the preview server in one terminal:

```sh
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Start the tunnel in a second terminal:

```sh
cloudflared tunnel --url http://127.0.0.1:4173 --http-host-header localhost
```

Open the `https://` URL printed by `cloudflared` on your phone. Install the app from the browser menu. On Android, choose **Install app**. On iPhone, open the link in Safari, tap **Share**, then choose **Add to Home Screen**.

Keep both terminals open while you install or use the app online. The service worker caches the app so it can open offline after its first online visit. A Quick Tunnel URL is temporary, changes each time `cloudflared` starts, and is public to anyone who knows it. An installed app is tied to that URL, so install it again when the URL changes.

## Verify

```sh
npm test
npm run build
npm run preview
```

The production build precaches the app shell and its assets. After `npm run preview` starts the built app, open it once while online, then reload it offline to use the drill.

On desktop, Chrome offers installation from its menu.

## App icons

The PWA, browser tab, and Apple home-screen icons are generated from `icon_blind.jpeg`:

```sh
npm run icons
```
