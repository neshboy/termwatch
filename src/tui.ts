import blessed from "blessed";
import type { ChildProcess } from "node:child_process";
import type { ContainerRow } from "./model.js";
import {
  isDockerAvailable,
  listContainers,
  restartContainer,
  stopContainer,
  tailLogs,
} from "./docker.js";
import { formatCpu, formatMem } from "./format.js";

const POLL_INTERVAL_MS = 2000;

const NAME_WIDTH = 30;
const STATE_WIDTH = 13;
const CPU_WIDTH = 9;
const MEM_WIDTH = 22;
const UPTIME_WIDTH = 18;

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, Math.max(0, width - 1)) + (width > 0 ? " " : "");
  return value + " ".repeat(width - value.length);
}

function stateTag(state: string): string {
  const normalized = state.toLowerCase();
  if (normalized === "running") return `{green-fg}${pad(state, STATE_WIDTH)}{/green-fg}`;
  if (normalized === "paused") return `{yellow-fg}${pad(state, STATE_WIDTH)}{/yellow-fg}`;
  return `{red-fg}${pad(state, STATE_WIDTH)}{/red-fg}`;
}

function columnHeaderLine(): string {
  return (
    "{bold}" +
    pad("NAME", NAME_WIDTH) +
    pad("STATE", STATE_WIDTH) +
    pad("CPU%", CPU_WIDTH) +
    pad("MEM", MEM_WIDTH) +
    pad("UPTIME", UPTIME_WIDTH) +
    "{/bold}"
  );
}

function rowToListLine(row: ContainerRow): string {
  return (
    pad(row.name, NAME_WIDTH) +
    stateTag(row.state) +
    pad(formatCpu(row.cpuPercent), CPU_WIDTH) +
    pad(formatMem(row), MEM_WIDTH) +
    pad(row.uptime, UPTIME_WIDTH)
  );
}

/**
 * Launches the real interactive terminal dashboard: polls the real Docker
 * daemon on a fixed interval, renders a live-updating, keyboard-navigable
 * list, and lets the operator drill into real live-tailed logs or mutate a
 * real container (restart/stop) with an explicit confirmation step first.
 */
export async function runTui(): Promise<void> {
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    console.error(
      "termwatch: could not reach the Docker daemon. Is Docker running and on your PATH?"
    );
    process.exitCode = 1;
    return;
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: "termwatch",
    fullUnicode: true,
  });

  let rows: ContainerRow[] = [];
  let mode: "list" | "logs" = "list";
  let logProcess: ChildProcess | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastSelectedId: string | null = null;

  const header = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    style: { fg: "white", bg: "blue" },
    content: " termwatch — live Docker container dashboard ",
  });

  const columnHeader = blessed.box({
    top: 1,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    content: columnHeaderLine(),
  });

  const list = blessed.list({
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-4",
    keys: false,
    mouse: true,
    tags: true,
    items: [],
    style: {
      selected: { bg: "cyan", fg: "black" },
      item: { fg: "white" },
    },
  });

  const logBox = blessed.log({
    top: 2,
    left: 0,
    width: "100%",
    height: "100%-4",
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    keys: true,
    vi: true,
    border: { type: "line" },
    label: " logs ",
    hidden: true,
    style: { border: { fg: "cyan" } },
  });

  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    style: { fg: "black", bg: "white" },
    content: " ↑/k ↓/j move   Enter logs   r restart   s stop   q quit ",
  });

  screen.append(header);
  screen.append(columnHeader);
  screen.append(list);
  screen.append(logBox);
  screen.append(footer);

  function setFooter(text: string): void {
    footer.setContent(` ${text} `);
    screen.render();
  }

  function selectedRow(): ContainerRow | undefined {
    const idx = (list as unknown as { selected: number }).selected ?? 0;
    return rows[idx];
  }

  function renderList(): void {
    const previousId = lastSelectedId;
    list.setItems(rows.map(rowToListLine) as unknown as blessed.Widgets.BlessedElement[]);
    if (rows.length > 0) {
      const restoreIdx = previousId ? rows.findIndex((r) => r.id === previousId) : -1;
      list.select(restoreIdx >= 0 ? restoreIdx : 0);
      lastSelectedId = selectedRow()?.id ?? null;
    } else {
      lastSelectedId = null;
    }
    screen.render();
  }

  async function refresh(): Promise<void> {
    try {
      rows = await listContainers();
      if (mode === "list") {
        renderList();
        setFooter(
          `↑/k ↓/j move   Enter logs   r restart   s stop   q quit   (${rows.length} containers, updated ${new Date().toLocaleTimeString()})`
        );
      }
    } catch (err) {
      setFooter(`error refreshing container list: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function startPolling(): void {
    if (pollTimer) return;
    pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function enterLogsMode(row: ContainerRow): void {
    mode = "logs";
    list.hide();
    columnHeader.hide();
    logBox.setLabel(` logs: ${row.name} (tail -f) `);
    logBox.setContent("");
    logBox.show();
    logBox.focus();
    setFooter("q/Esc back to list   Ctrl-C quit");

    logProcess = tailLogs(row.name, 100);
    logProcess.stdout?.on("data", (chunk: Buffer) => logBox.log(chunk.toString().trimEnd()));
    logProcess.stderr?.on("data", (chunk: Buffer) => logBox.log(chunk.toString().trimEnd()));
    logProcess.on("error", (err) => logBox.log(`{red-fg}[termwatch] failed to tail logs: ${err.message}{/red-fg}`));
    screen.render();
  }

  function exitLogsMode(): void {
    if (logProcess) {
      logProcess.kill();
      logProcess = null;
    }
    mode = "list";
    logBox.hide();
    columnHeader.show();
    list.show();
    list.focus();
    setFooter(
      `↑/k ↓/j move   Enter logs   r restart   s stop   q quit   (${rows.length} containers)`
    );
    screen.render();
  }

  function confirmAction(message: string, onConfirm: () => Promise<void>): void {
    const dialog = blessed.question({
      parent: screen,
      border: { type: "line" },
      height: "shrink",
      width: "half",
      top: "center",
      left: "center",
      label: " confirm ",
      tags: true,
      style: { border: { fg: "yellow" } },
    });
    dialog.ask(message, (_err, confirmed) => {
      dialog.destroy();
      screen.render();
      if (confirmed) {
        setFooter("working…");
        onConfirm()
          .then(() => refresh())
          .catch((err) =>
            setFooter(`error: ${err instanceof Error ? err.message : String(err)}`)
          );
      }
      list.focus();
    });
  }

  list.on("keypress", (_ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
    if (mode !== "list") return;
    if (key.name === "down" || key.name === "j") {
      list.down(1);
      lastSelectedId = selectedRow()?.id ?? lastSelectedId;
      screen.render();
    } else if (key.name === "up" || key.name === "k") {
      list.up(1);
      lastSelectedId = selectedRow()?.id ?? lastSelectedId;
      screen.render();
    } else if (key.name === "enter" || key.name === "return") {
      const row = selectedRow();
      if (row) enterLogsMode(row);
    } else if (key.name === "r") {
      const row = selectedRow();
      if (row) {
        confirmAction(
          `Restart real container "${row.name}"? This mutates a running container. (y/n)`,
          () => restartContainer(row.id)
        );
      }
    } else if (key.name === "s") {
      const row = selectedRow();
      if (row) {
        confirmAction(
          `Stop real container "${row.name}"? This mutates a running container. (y/n)`,
          () => stopContainer(row.id)
        );
      }
    } else if (key.name === "q") {
      cleanupAndExit();
    }
  });

  logBox.key(["q", "escape"], () => exitLogsMode());
  screen.key(["C-c"], () => cleanupAndExit());

  function cleanupAndExit(): void {
    stopPolling();
    if (logProcess) logProcess.kill();
    screen.destroy();
    process.exit(0);
  }

  list.focus();
  await refresh();
  startPolling();
  screen.render();
}
