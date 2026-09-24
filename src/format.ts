import type { ContainerRow } from "./model.js";

const COLUMNS = [
  { key: "name", header: "NAME", width: 28 },
  { key: "state", header: "STATE", width: 12 },
  { key: "cpu", header: "CPU%", width: 8 },
  { key: "mem", header: "MEM", width: 26 },
  { key: "uptime", header: "UPTIME", width: 16 },
  { key: "image", header: "IMAGE", width: 30 },
] as const;

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  return value.slice(0, width - 1) + "…"; // ellipsis
}

function pad(value: string, width: number): string {
  const truncated = truncate(value, width);
  return truncated + " ".repeat(Math.max(0, width - truncated.length));
}

export function formatCpu(cpuPercent: number | null): string {
  return cpuPercent === null ? "n/a" : `${cpuPercent.toFixed(2)}%`;
}

export function formatMem(row: Pick<ContainerRow, "memUsage" | "memPercent">): string {
  if (!row.memUsage) return "n/a";
  const pct = row.memPercent === null ? "" : ` (${row.memPercent.toFixed(1)}%)`;
  return `${row.memUsage}${pct}`;
}

/**
 * Renders a fixed-width plain-text table of container rows, used by
 * `termwatch snapshot` (and by the TUI's underlying list model). Deliberately
 * dependency-free string formatting so it's trivial to unit test and safe to
 * pipe through SSH/scripts without any TTY control codes.
 */
export function formatSnapshotTable(rows: ContainerRow[]): string {
  const header = COLUMNS.map((c) => pad(c.header, c.width)).join(" ");
  const separator = COLUMNS.map((c) => "-".repeat(c.width)).join(" ");

  if (rows.length === 0) {
    return [header, separator, "(no running containers)"].join("\n");
  }

  const lines = rows.map((row) => {
    const cells: Record<(typeof COLUMNS)[number]["key"], string> = {
      name: row.name,
      state: row.state,
      cpu: formatCpu(row.cpuPercent),
      mem: formatMem(row),
      uptime: row.uptime,
      image: row.image,
    };
    return COLUMNS.map((c) => pad(cells[c.key], c.width)).join(" ");
  });

  return [header, separator, ...lines].join("\n");
}
