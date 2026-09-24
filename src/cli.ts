#!/usr/bin/env node
import { isDockerAvailable, listContainers } from "./docker.js";
import { formatSnapshotTable } from "./format.js";
import { runTui } from "./tui.js";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`termwatch - live Docker container dashboard

Usage:
  termwatch                Launch the interactive TUI dashboard
  termwatch snapshot       Print a one-shot table of real container data (no TUI)
  termwatch --help         Show this help
  termwatch --version      Show the version

Keyboard controls (interactive mode):
  up/k, down/j   Move selection
  Enter          Tail live logs for the selected container
  r              Restart the selected container (asks for confirmation)
  s              Stop the selected container (asks for confirmation)
  q / Esc        Back out of logs, or quit from the list
  Ctrl-C         Quit
`);
}

async function runSnapshot(): Promise<void> {
  const available = await isDockerAvailable();
  if (!available) {
    console.error(
      "termwatch: could not reach the Docker daemon. Is Docker running and on your PATH?"
    );
    process.exitCode = 1;
    return;
  }
  const rows = await listContainers();
  console.log(formatSnapshotTable(rows));
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);

  switch (command) {
    case undefined:
      await runTui();
      return;
    case "snapshot":
      await runSnapshot();
      return;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      return;
    case "--version":
    case "-v":
      console.log(VERSION);
      return;
    default:
      console.error(`termwatch: unknown command "${command}"`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("termwatch: fatal error:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
