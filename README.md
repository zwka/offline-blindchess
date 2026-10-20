# Offline Blind Chess

## 1. Description

An installable, offline-first chess-training app with six 60-second drills: Square Colors, Same Color, Coordinates, Diagonals, Quadrant, and Knight. It saves attempt history and personal bests in the current browser on this device.

## 2. Prerequisites

- Node.js with npm to install, develop, and build the app.
- A modern browser to use the app. Installable PWA features and offline use require the app to be served over HTTPS, or from `localhost` during development.
- Optional: `cloudflared` to open a temporary HTTPS tunnel to the production build for testing or installing on a phone. The included tunnel command supports macOS and Linux.

## 3. Development Setup

1. Open a terminal in the repository directory.
2. Install dependencies:

   ```sh
   npm ci
   ```

3. Start the development server:

   ```sh
   npm run dev
   ```

4. Open the local URL printed in the terminal, usually `http://localhost:5173`.
5. To run the tests, use `npm test`.

## 4. Production Setup

1. From the repository directory, install dependencies and build the app:

   ```sh
   npm ci
   npm run build
   ```

   The production-ready files are written to `dist/`.

2. Check the production build locally by running `npm run preview` and opening the URL printed in the terminal.
3. Publish the contents of `dist/` to a static web host configured to serve the app over HTTPS. This repository does not configure a specific hosting provider.
4. Open the hosted app once while online. Use the browser's install option to add it to a device; after the first online visit, the app shell is cached for offline use.

For a temporary phone test without publishing, install `cloudflared` (on macOS with Homebrew, run `brew install cloudflared`), then run:

```sh
./offline-blindchess --install-mobile
```

Open the printed HTTPS URL on the phone and install from the browser menu. The temporary URL is public to anyone who knows it and changes when the tunnel restarts. Stop the preview server and tunnel with:

```sh
./offline-blindchess --shutdown
```
