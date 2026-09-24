import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import type { ContainerRow } from "./model.js";
import { mergeContainerData, parsePsOutput, parseStatsOutput } from "./parse.js";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10MB, generous for large container lists

/**
 * Runs the real `docker ps --format '{{json .}}'` command against the local
 * Docker daemon. Always invoked as an argv array (never a shell string) so
 * there is no shell-injection surface.
 */
export async function fetchPs(): Promise<string> {
  const { stdout } = await execFileAsync(
    "docker",
    ["ps", "--format", "{{json .}}"],
    { maxBuffer: MAX_BUFFER }
  );
  return stdout;
}

/**
 * Runs the real `docker stats --no-stream --format '{{json .}}'` command.
 * `--no-stream` makes this a single point-in-time sample rather than an
 * ongoing stream, which is what both snapshot mode and each TUI poll tick want.
 */
export async function fetchStats(): Promise<string> {
  const { stdout } = await execFileAsync(
    "docker",
    ["stats", "--no-stream", "--format", "{{json .}}"],
    { maxBuffer: MAX_BUFFER }
  );
  return stdout;
}

/**
 * Fetches real `docker ps` + `docker stats` output from the local daemon and
 * merges them into the internal ContainerRow model. This is the single
 * function both `termwatch snapshot` and the live TUI poll loop call.
 */
export async function listContainers(): Promise<ContainerRow[]> {
  const [psRaw, statsRaw] = await Promise.all([fetchPs(), fetchStats()]);
  const psEntries = parsePsOutput(psRaw);
  const statsEntries = parseStatsOutput(statsRaw);
  return mergeContainerData(psEntries, statsEntries);
}

/**
 * Checks whether the Docker CLI can talk to a real daemon (`docker info`).
 * Used to fail fast with a clear message instead of a raw ENOENT/ECONNREFUSED.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], {
      maxBuffer: MAX_BUFFER,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restarts a real running container by ID or name. This mutates real state -
 * callers (the TUI) must confirm with the user before invoking this.
 */
export async function restartContainer(idOrName: string): Promise<void> {
  await execFileAsync("docker", ["restart", idOrName], { maxBuffer: MAX_BUFFER });
}

/**
 * Stops a real running container by ID or name. This mutates real state -
 * callers (the TUI) must confirm with the user before invoking this.
 */
export async function stopContainer(idOrName: string): Promise<void> {
  await execFileAsync("docker", ["stop", idOrName], { maxBuffer: MAX_BUFFER });
}

/**
 * Spawns a real, live-tailing `docker logs --tail <n> -f <container>` process.
 * Returns the ChildProcess so the caller (the TUI log viewer) can pipe
 * stdout/stderr into a scrollable panel and kill it when the user backs out.
 * Uses spawn with an argv array (never a shell string).
 */
export function tailLogs(idOrName: string, tailLines = 100): ChildProcess {
  return spawn("docker", ["logs", "--tail", String(tailLines), "-f", idOrName], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}
