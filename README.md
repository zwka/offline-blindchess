# Offline Blind Chess

An installable, offline-first chess-training PWA. V1 includes the Square Colors drill and on-device attempt history.

## Play Square Colors

Each attempt lasts 60 seconds. Identify a square as Light or Dark. Every correct answer adds one point, and the results show your score, answer count, and accuracy.

Choose **Light** with the left arrow button or left arrow key. Choose **Dark** with the right arrow button or right arrow key. The app pauses the timer when you switch away and resumes when you return. Closing the app before the attempt ends discards that attempt.

Completed attempts stay in this browser on this device. Open **History** to review them or clear the saved history. Clearing this browser's site data also removes saved attempts.

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

The PWA and Apple home-screen icons are generated locally from the checkerboard mark:

```sh
npm run icons
```
