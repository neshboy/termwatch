/**
 * Internal container-state model that the rest of Termwatch (snapshot table,
 * TUI list, log viewer) is built on. Everything upstream of this file deals
 * in raw Docker CLI JSON; everything downstream deals in these clean shapes.
 */

/** One line of `docker ps --format '{{json .}}'` output, as documented by Docker. */
export interface DockerPsEntry {
  ID: string;
  Image: string;
  Command: string;
  CreatedAt: string;
  RunningFor: string;
  Status: string;
  Ports: string;
  Names: string;
  Labels: string;
  State: string;
  Size: string;
  Networks?: string;
  Mounts?: string;
  LocalVolumes?: string;
}

/** One line of `docker stats --no-stream --format '{{json .}}'` output. */
export interface DockerStatsEntry {
  BlockIO: string;
  CPUPerc: string;
  Container: string;
  ID?: string;
  MemPerc: string;
  MemUsage: string;
  Name: string;
  NetIO: string;
  PIDs: string;
}

/** A container's live health, merged from `docker ps` + `docker stats`. */
export interface ContainerRow {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  uptime: string;
  cpuPercent: number | null;
  memUsage: string | null;
  memPercent: number | null;
  ports: string;
}

export type SortKey = "name" | "cpu" | "mem" | "state";
