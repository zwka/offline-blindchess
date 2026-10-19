# Offline Blind Chess

An installable, offline-first chess-training PWA with Square Colors, Same Color, Coordinates, and on-device attempt history.

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

## Verify

```sh
npm test
npm run build
npm run preview
```

The production build precaches the app shell and its assets. After `npm run preview` starts the built app, open it once while online, then reload it offline to use the drill.

Chrome offers installation from its menu on desktop and Android. On iPhone, use Chrome's Share menu and choose **Add to Home Screen**.

## App icons

The PWA, browser tab, and Apple home-screen icons are generated from `icon_blind.jpeg`:

```sh
npm run icons
```
