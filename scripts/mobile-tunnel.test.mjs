import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { chmod, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const commandPath = fileURLToPath(new URL("../offline-blindchess", import.meta.url));
const canUsePreviewPort = await isPortAvailable(4173);

it("prints usage for an unsupported command", () => {
  const result = spawnSync(commandPath, ["--unknown"], {
    cwd: projectRoot,
    encoding: "utf8"
  });

  expect(result.status).toBe(2);
  expect(result.stderr).toContain("Usage:");
});

it.skipIf(!canUsePreviewPort)("starts once, reuses the URL, and shuts down cleanly", async () => {
  const workspace = await createTestWorkspace();

  try {
    const start = await runCommand(workspace, ["--install-mobile"]);
    expect(start.code).toBe(0);
    expect(start.stdout).toContain("https://integration-test.trycloudflare.com");

    const repeatedStart = await runCommand(workspace, ["--install-mobile"]);
    expect(repeatedStart.code).toBe(0);
    expect(repeatedStart.stdout).toContain("already running");
    expect(repeatedStart.stdout).toContain("https://integration-test.trycloudflare.com");

    const shutdown = await runCommand(workspace, ["--shutdown"]);
    expect(shutdown.code).toBe(0);
    expect(shutdown.stdout).toContain("stopped");
    await expect(fetch("http://127.0.0.1:4173")).rejects.toThrow();

    const repeatedShutdown = await runCommand(workspace, ["--shutdown"]);
    expect(repeatedShutdown.code).toBe(0);
    expect(repeatedShutdown.stdout).toContain("No mobile preview is running");
  } finally {
    await runCommand(workspace, ["--shutdown"]);
    await rm(workspace, { recursive: true, force: true });
  }
}, 30000);

it.skipIf(!canUsePreviewPort)("does not tunnel an unrelated listener on port 4173", async () => {
  const workspace = await createTestWorkspace();
  const unrelatedServer = createServer((_request, response) => {
    response.end("<title>Offline Blind Chess</title>");
  });

  await new Promise((resolve, reject) => {
    unrelatedServer.once("error", reject);
    unrelatedServer.listen(4173, "127.0.0.1", resolve);
  });

  try {
    const start = await runCommand(workspace, ["--install-mobile"]);
    expect(start.code).not.toBe(0);
    expect(start.stderr).toMatch(/EADDRINUSE|address already in use/i);
    expect(start.stdout).not.toContain("https://integration-test.trycloudflare.com");

    const response = await fetch("http://127.0.0.1:4173");
    expect(await response.text()).toBe("<title>Offline Blind Chess</title>");
  } finally {
    await runCommand(workspace, ["--shutdown"]);
    await new Promise((resolve) => unrelatedServer.close(resolve));
    await rm(workspace, { recursive: true, force: true });
  }
}, 30000);

async function createTestWorkspace() {
  const workspace = await mkdtemp(join(tmpdir(), "offline-blindchess-mobile-"));
  const scriptsDirectory = join(workspace, "scripts");
  const binDirectory = join(workspace, "test-bin");
  await mkdir(scriptsDirectory);
  await mkdir(binDirectory);
  await copyFile(commandPath, join(workspace, "offline-blindchess"));
  await copyFile(join(projectRoot, "scripts/mobile-tunnel.mjs"), join(scriptsDirectory, "mobile-tunnel.mjs"));
  await writeFile(join(workspace, "package.json"), '{"type":"module"}\n');
  await chmod(join(workspace, "offline-blindchess"), 0o755);

  const fakeNpmPath = join(scriptsDirectory, "fake-npm.mjs");
  const fakeCloudflaredPath = join(scriptsDirectory, "fake-cloudflared.mjs");
  await writeFile(fakeNpmPath, fakeNpmSource);
  await writeFile(fakeCloudflaredPath, fakeCloudflaredSource);
  await writeExecutable(binDirectory, "npm", fakeNpmPath);
  await writeExecutable(binDirectory, "cloudflared", fakeCloudflaredPath);

  return workspace;
}

async function writeExecutable(binDirectory, name, scriptPath) {
  const wrapperPath = join(binDirectory, name);
  await writeFile(
    wrapperPath,
    `#!/bin/sh\nexec '${process.execPath}' '${scriptPath}' "$@"\n`
  );
  await chmod(wrapperPath, 0o755);
}

function runCommand(workspace, args) {
  const binDirectory = join(workspace, "test-bin");
  const child = spawn(join(workspace, "offline-blindchess"), args, {
    cwd: workspace,
    env: {
      ...process.env,
      PATH: `${binDirectory}${delimiter}${process.env.PATH}`
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGKILL"), 20000);
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

function isPortAvailable(port) {
  const server = createServer();
  return new Promise((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

const fakeNpmSource = `
import { createServer } from "node:http";

const args = process.argv.slice(2);
if (args[0] === "install" || (args[0] === "run" && args[1] === "build")) {
  process.exit(0);
}
if (args[0] !== "run" || args[1] !== "preview") {
  process.exit(2);
}

const server = createServer((_request, response) => {
  response.end("<title>Offline Blind Chess</title>");
});
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
server.listen(4173, "127.0.0.1", () => {
  console.log("Local: http://127.0.0.1:4173/");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
`;

const fakeCloudflaredSource = `
const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.exit(0);
}
if (args[0] !== "tunnel") {
  process.exit(2);
}

console.log("https://integration-test.trycloudflare.com");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1000);
`;
