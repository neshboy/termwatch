import type { ContainerRow, DockerPsEntry, DockerStatsEntry } from "./model.js";

/**
 * Docker's `--format '{{json .}}'` flag prints one JSON object per line
 * (JSON-lines, not a JSON array). Split on newlines, drop blanks, parse each.
 */
export function parseJsonLines<T>(raw: string): T[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

export function parsePsOutput(raw: string): DockerPsEntry[] {
  return parseJsonLines<DockerPsEntry>(raw);
}

export function parseStatsOutput(raw: string): DockerStatsEntry[] {
  return parseJsonLines<DockerStatsEntry>(raw);
}

/** Parses a percentage string like "0.42%" into a number like 0.42. Returns null if unparseable. */
export function parsePercent(value: string | undefined | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * `docker ps --format '{{json .}}'` reports Names without the leading slash
 * that the raw Engine API uses, but a container can have multiple names
 * separated by commas (e.g. compose aliases); take the first.
 */
export function primaryName(names: string): string {
  return names.split(",")[0]?.trim() ?? names;
}

/**
 * Merges a `docker ps` snapshot with a `docker stats` snapshot into the
 * internal ContainerRow model used by both the snapshot table and the TUI.
 * Stats are matched to ps entries by container ID (stats truncates to a
 * short ID, so we match on the shared short-ID prefix).
 */
export function mergeContainerData(
  psEntries: DockerPsEntry[],
  statsEntries: DockerStatsEntry[]
): ContainerRow[] {
  const statsByShortId = new Map<string, DockerStatsEntry>();
  for (const stat of statsEntries) {
    const key = (stat.ID ?? stat.Container ?? "").trim();
    if (key) statsByShortId.set(key, stat);
  }

  return psEntries.map((ps) => {
    const shortId = ps.ID.slice(0, 12);
    const stat =
      statsByShortId.get(ps.ID) ??
      statsByShortId.get(shortId) ??
      [...statsByShortId.values()].find(
        (s) => ps.ID.startsWith((s.ID ?? s.Container ?? "").trim()) && (s.ID ?? s.Container ?? "").length > 0
      );

    return {
      id: ps.ID,
      shortId,
      name: primaryName(ps.Names),
      image: ps.Image,
      state: ps.State,
      status: ps.Status,
      uptime: ps.RunningFor || ps.Status,
      cpuPercent: stat ? parsePercent(stat.CPUPerc) : null,
      memUsage: stat ? stat.MemUsage : null,
      memPercent: stat ? parsePercent(stat.MemPerc) : null,
      ports: ps.Ports ?? "",
    };
  });
}
