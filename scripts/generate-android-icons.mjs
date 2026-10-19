import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("../icon_blind.jpeg", import.meta.url));
const resourceDirectory = new URL("../android/app/src/main/res/", import.meta.url);
const densities = [
  ["mdpi", 1],
  ["hdpi", 1.5],
  ["xhdpi", 2],
  ["xxhdpi", 3],
  ["xxxhdpi", 4]
];

for (const [densityName, scale] of densities) {
  const directory = fileURLToPath(new URL(`mipmap-${densityName}/`, resourceDirectory));
  const iconSize = Math.round(48 * scale);
  const adaptiveSize = Math.round(108 * scale);
  const foregroundSize = Math.round(66 * scale);
  const inset = Math.round((adaptiveSize - foregroundSize) / 2);
  await mkdir(directory, { recursive: true });

  const squareIcon = sharp(sourcePath).resize(iconSize, iconSize);
  await squareIcon.clone().png().toFile(`${directory}/ic_launcher.png`);
  await squareIcon.clone()
    .composite([{
      input: Buffer.from(`<svg width="${iconSize}" height="${iconSize}"><circle cx="${iconSize / 2}" cy="${iconSize / 2}" r="${iconSize / 2}" fill="#fff"/></svg>`),
      blend: "dest-in"
    }])
    .png()
    .toFile(`${directory}/ic_launcher_round.png`);

  const foreground = await sharp(sourcePath).resize(foregroundSize, foregroundSize).png().toBuffer();
  await sharp({
    create: {
      width: adaptiveSize,
      height: adaptiveSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: foreground, left: inset, top: inset }])
    .png()
    .toFile(`${directory}/ic_launcher_foreground.png`);
}

const splashTargets = [
  ["drawable/splash.png", 480, 320],
  ["drawable-port-mdpi/splash.png", 320, 480],
  ["drawable-port-hdpi/splash.png", 480, 720],
  ["drawable-port-xhdpi/splash.png", 640, 960],
  ["drawable-port-xxhdpi/splash.png", 960, 1440],
  ["drawable-port-xxxhdpi/splash.png", 1280, 1920],
  ["drawable-land-mdpi/splash.png", 480, 320],
  ["drawable-land-hdpi/splash.png", 720, 480],
  ["drawable-land-xhdpi/splash.png", 960, 640],
  ["drawable-land-xxhdpi/splash.png", 1440, 960],
  ["drawable-land-xxxhdpi/splash.png", 1920, 1280]
];

for (const [relativePath, width, height] of splashTargets) {
  const outputPath = fileURLToPath(new URL(`../android/app/src/main/res/${relativePath}`, import.meta.url));
  const directory = outputPath.slice(0, outputPath.lastIndexOf("/"));
  const iconSize = Math.round(Math.min(width, height) * 0.4);
  const insetX = Math.round((width - iconSize) / 2);
  const insetY = Math.round((height - iconSize) / 2);
  await mkdir(directory, { recursive: true });
  const icon = await sharp(sourcePath).resize(iconSize, iconSize).png().toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#f4f3ee"
    }
  })
    .composite([{ input: icon, left: insetX, top: insetY }])
    .png()
    .toFile(outputPath);
}
