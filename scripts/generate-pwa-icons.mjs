import sharp from "sharp";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../icon_blind.jpeg", import.meta.url));
const publicDirectory = new URL("../public/", import.meta.url);
const icons = [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["apple-touch-icon.png", 180],
  ["favicon.png", 64]
];

for (const [name, size] of icons) {
  const output = fileURLToPath(new URL(name, publicDirectory));
  await sharp(source)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(output);
}
