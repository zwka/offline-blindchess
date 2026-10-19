import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pwaDir = path.join(root, "dist/pwa");
const androidDir = path.join(root, "dist/android");

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(entryPath) : [entryPath];
  }));
  return files.flat();
}

const pwaHtml = await readFile(path.join(pwaDir, "index.html"), "utf8");
assert.match(pwaHtml, /rel="manifest"/, "the PWA build includes its web manifest");
assert.ok((await filesUnder(pwaDir)).some((file) => path.basename(file) === "sw.js"), "the PWA build emits a service worker");

const pwaScripts = (await filesUnder(pwaDir))
  .filter((file) => file.endsWith(".js"))
  .map((file) => readFile(file, "utf8"));
const pwaBundle = (await Promise.all(pwaScripts)).join("\n");
assert.match(pwaBundle, /Install/, "the PWA build retains its install command");
assert.match(pwaBundle, /beforeinstallprompt/, "the PWA build retains browser installation UI");
assert.match(pwaBundle, /serviceWorker/, "the PWA build retains service-worker registration");

const androidHtml = await readFile(path.join(androidDir, "index.html"), "utf8");
assert.doesNotMatch(androidHtml, /rel="manifest"/, "the Android asset build does not inject a PWA manifest");

const androidFiles = await filesUnder(androidDir);
assert.ok(!androidFiles.some((file) => ["sw.js", "manifest.webmanifest"].includes(path.basename(file))), "the Android asset build does not include PWA worker files");

const androidScripts = androidFiles
  .filter((file) => file.endsWith(".js"))
  .map((file) => readFile(file, "utf8"));
const androidBundle = (await Promise.all(androidScripts)).join("\n");
assert.doesNotMatch(androidBundle, /beforeinstallprompt|Install|Add to Home Screen|open the menu/, "the Android build excludes browser PWA installation UI");
assert.doesNotMatch(androidBundle, /registerSW|serviceWorker\.register/, "the Android build does not start or update a web service worker");

console.log("PWA and Android build targets have isolated install and service-worker behavior.");
