import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const colors = {
  background: [244, 243, 238, 255],
  light: [250, 249, 244, 255],
  dark: [29, 107, 83, 255]
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createIcon(size) {
  const margin = Math.round(size * 0.13);
  const boardSize = size - margin * 2;
  const tileSize = boardSize / 8;
  const raw = Buffer.alloc((size * 4 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    for (let x = 0; x < size; x += 1) {
      const insideBoard = x >= margin && y >= margin && x < size - margin && y < size - margin;
      let color = colors.background;
      if (insideBoard) {
        const file = Math.floor((x - margin) / tileSize);
        const row = Math.floor((y - margin) / tileSize);
        color = (file + row) % 2 === 1 ? colors.dark : colors.light;
      }
      const pixel = rowOffset + 1 + x * 4;
      raw.set(color, pixel);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const [name, size] of [["pwa-192x192.png", 192], ["pwa-512x512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), createIcon(size));
}
