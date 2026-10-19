import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const runtimeDirectory = join(projectRoot, ".offline-blindchess");
const statePath = join(runtimeDirectory, "session.json");
const previewUrl = "http://127.0.0.1:4173";
const previewArguments = [
  "run",
  "preview",
  "--",
  "--host",
  "127.0.0.1",
  "--port",
  "4173",
  "--strictPort"
];
const tunnelArguments = [
  "tunnel",
  "--url",
  previewUrl,
  "--http-host-header",
  "localhost"
];
const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export async function run(args) {
  if (args.length !== 1 || !["--install-mobile", "--shutdown"].includes(args[0])) {
    console.error(
      "Usage:\n  ./offline-blindchess --install-mobile\n  ./offline-blindchess --shutdown"
    );
    return 2;
  }

  if (!new Set(["darwin", "linux"]).has(process.platform)) {
    console.error("The mobile command supports macOS and Linux.");
    return 1;
  }

  try {
    if (args[0] === "--shutdown") {
      await shutdownMobile();
    } else {
      await installMobile();
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function installMobile() {
  const existingSession = readSession();
  if (existingSession && (await isSessionHealthy(existingSession))) {
    console.log(`Mobile preview is already running:\n${existingSession.url}`);
    return;
  }

  if (existingSession) {
    await stopSession(existingSession);
    removeSession();
  }

  if (!isCloudflaredAvailable()) {
    throw new Error(
      "cloudflared is required. Install it from https://developers.cloudflare.com/tunnel/downloads/ and retry."
    );
  }

  runNpm(["install"]);
  runNpm(["run", "build"]);

  mkdirSync(runtimeDirectory, { recursive: true });
  const session = {
    version: 1,
    id: randomUUID(),
    previewPid: null,
    previewStartedAt: null,
    tunnelPid: null,
    tunnelStartedAt: null,
    url: null
  };

  try {
    const previewProcess = await startDetachedProcess(
      "npm",
      previewArguments,
      logPath(session, "preview")
    );
    session.previewPid = previewProcess.pid;
    session.previewStartedAt = previewProcess.startedAt;
    writeSession(session);

    await waitForPreview(session);

    const tunnelProcess = await startDetachedProcess(
      "cloudflared",
      tunnelArguments,
      logPath(session, "tunnel")
    );
    session.tunnelPid = tunnelProcess.pid;
    session.tunnelStartedAt = tunnelProcess.startedAt;
    writeSession(session);

    session.url = await waitForTunnelUrl(session);
    writeSession(session);
    console.log(`Mobile preview is running:\n${session.url}`);
  } catch (error) {
    try {
      await stopSession(session);
      removeSession();
    } catch (cleanupError) {
      throw new Error(
        `${errorMessage(error)}\nCleanup also failed: ${errorMessage(cleanupError)}\nRun ./offline-blindchess --shutdown to retry.`
      );
    }

    throw new Error(`${errorMessage(error)}\nLogs: ${runtimeDirectory}`);
  }
}

async function shutdownMobile() {
  const session = readSession();
  if (!session) {
    console.log("No mobile preview is running.");
    return;
  }

  await stopSession(session);
  removeSession();
  console.log("Mobile preview and tunnel stopped.");
}

function runNpm(args) {
  console.log(`> npm ${args.join(" ")}`);
  const result = spawnSync("npm", args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.error) {
    throw new Error(`Could not run npm: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`npm ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}

function isCloudflaredAvailable() {
  const result = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function startDetachedProcess(command, args, outputPath) {
  const descriptor = openSync(outputPath, "a", 0o600);
  let child;

  try {
    child = spawn(command, args, {
      cwd: projectRoot,
      detached: true,
      stdio: ["ignore", descriptor, descriptor]
    });
  } finally {
    closeSync(descriptor);
  }

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", () => {
      const startedAt = readProcessStartTime(child.pid);
      if (!startedAt) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch (error) {
          if (error.code !== "ESRCH") {
            reject(error);
            return;
          }
        }
        reject(new Error(`Could not identify the new ${command} process.`));
        return;
      }
      child.unref();
      resolve({ pid: child.pid, startedAt });
    });
  });
}

async function waitForPreview(session) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    if (!hasManagedProcess(session.previewPid, "preview", session.previewStartedAt)) {
      throw new Error(`The preview server exited before it became ready.\n${readLog(session, "preview")}`);
    }

    if (await previewIsReady(session)) {
      return;
    }

    await delay(250);
  }

  throw new Error(`The preview server did not become ready on ${previewUrl}.\n${readLog(session, "preview")}`);
}

async function previewIsReady(session) {
  let startupLog;
  try {
    startupLog = readFileSync(logPath(session, "preview"), "utf8");
  } catch {
    return false;
  }

  if (!/Local:\s+http:\/\/127\.0\.0\.1:4173\/?/.test(startupLog)) {
    return false;
  }

  try {
    const response = await fetch(previewUrl, { signal: AbortSignal.timeout(500) });
    const html = await response.text();
    return response.ok && html.includes("<title>Offline Blind Chess</title>");
  } catch {
    return false;
  }
}

async function waitForTunnelUrl(session) {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    const match = readFileSync(logPath(session, "tunnel"), "utf8").match(urlPattern);
    if (match) {
      return match[0];
    }

    if (!hasManagedProcess(session.tunnelPid, "tunnel", session.tunnelStartedAt)) {
      throw new Error(`cloudflared exited before returning a tunnel URL.\n${readLog(session, "tunnel")}`);
    }

    await delay(250);
  }

  throw new Error(`cloudflared did not return a URL within 60 seconds.\n${readLog(session, "tunnel")}`);
}

async function isSessionHealthy(session) {
  return Boolean(
    session.url &&
      session.previewPid &&
      session.tunnelPid &&
      hasManagedProcess(session.previewPid, "preview", session.previewStartedAt) &&
      hasManagedProcess(session.tunnelPid, "tunnel", session.tunnelStartedAt) &&
      (await previewIsReady(session))
  );
}

async function stopSession(session) {
  const groups = [
    [session.previewPid, "preview", session.previewStartedAt],
    [session.tunnelPid, "tunnel", session.tunnelStartedAt]
  ].filter(([pid, , startedAt]) => Number.isInteger(pid) && pid > 1 && typeof startedAt === "string");

  for (const [pid, processRole, startedAt] of groups) {
    signalManagedProcess(pid, processRole, startedAt, "SIGTERM");
  }

  await Promise.all(
    groups.map(([pid, processRole, startedAt]) => waitForProcessStop(pid, processRole, startedAt))
  );
}

async function waitForProcessStop(pid, processRole, startedAt) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!hasManagedProcess(pid, processRole, startedAt)) {
      return;
    }
    await delay(100);
  }

  signalManagedProcess(pid, processRole, startedAt, "SIGKILL");
  await delay(100);
  if (hasManagedProcess(pid, processRole, startedAt)) {
    throw new Error(`Could not stop the managed ${processRole} process group ${pid}.`);
  }
}

function signalManagedProcess(pid, processRole, startedAt, signal) {
  if (!hasManagedProcess(pid, processRole, startedAt)) {
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
  }
}

function hasManagedProcess(processGroupId, processRole, startedAt) {
  if (!Number.isInteger(processGroupId) || processGroupId <= 1 || typeof startedAt !== "string") {
    return false;
  }

  const result = spawnSync("ps", ["-axo", "pid=,pgid=,command="], {
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024
  });

  if (result.error || result.status !== 0) {
    throw new Error(`Could not inspect managed processes with ps: ${result.error?.message ?? "ps failed"}`);
  }

  const members = result.stdout.split("\n").flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (!match || Number(match[2]) !== processGroupId) {
      return [];
    }

    return [{ pid: Number(match[1]), command: match[3].toLowerCase() }];
  });

  const hasExpectedCommand = members.some(({ command }) => {
    if (processRole === "preview") {
      return command.includes("preview") && (command.includes("npm") || command.includes("vite"));
    }
    return command.includes("cloudflared") && command.includes("tunnel");
  });
  if (!hasExpectedCommand) {
    return false;
  }

  const leaderIsRunning = members.some(({ pid }) => pid === processGroupId);
  return !leaderIsRunning || readProcessStartTime(processGroupId) === startedAt;
}

function readProcessStartTime(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function readSession() {
  if (!existsSync(statePath)) {
    return null;
  }

  let session;
  try {
    session = JSON.parse(readFileSync(statePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${statePath}: ${error.message}`);
  }

  if (
    session === null ||
    typeof session !== "object" ||
    Array.isArray(session) ||
    session.version !== 1 ||
    typeof session.id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(session.id) ||
    !isValidProcessState(session.previewPid, session.previewStartedAt) ||
    !isValidProcessState(session.tunnelPid, session.tunnelStartedAt) ||
    (session.url !== null && !isTunnelUrl(session.url))
  ) {
    throw new Error(`Invalid mobile session state in ${statePath}.`);
  }

  return session;
}

function isValidProcessState(pid, startedAt) {
  return (
    (pid === null && startedAt === null) ||
    (Number.isSafeInteger(pid) && pid > 1 && typeof startedAt === "string" && startedAt.length > 0)
  );
}

function isTunnelUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function writeSession(session) {
  mkdirSync(dirname(statePath), { recursive: true });
  const temporaryPath = join(runtimeDirectory, `session-${process.pid}-${randomUUID()}.tmp`);
  writeFileSync(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, statePath);
}

function removeSession() {
  rmSync(statePath, { force: true });
}

function logPath(session, kind) {
  return join(runtimeDirectory, `${session.id}-${kind}.log`);
}

function readLog(session, kind) {
  try {
    const lines = readFileSync(logPath(session, kind), "utf8").trim().split("\n");
    return lines.slice(-20).join("\n");
  } catch {
    return "No process log was written.";
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
