import { describe, expect, it } from "vitest";
import {
  mergeContainerData,
  parseJsonLines,
  parsePercent,
  parsePsOutput,
  parseStatsOutput,
  primaryName,
} from "../src/parse.js";
import {
  PS_LINE_POSTGRES,
  PS_LINE_RESTARTING,
  PS_OUTPUT_MULTI_LINE,
  STATS_LINE_POSTGRES,
  STATS_OUTPUT_MULTI_LINE,
} from "./fixtures.js";

describe("parseJsonLines", () => {
  it("parses one JSON object per line", () => {
    const result = parseJsonLines<{ a: number }>('{"a":1}\n{"a":2}');
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("ignores blank lines and trailing newline", () => {
    const result = parseJsonLines<{ a: number }>('{"a":1}\n\n{"a":2}\n');
    expect(result).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("returns an empty array for empty output", () => {
    expect(parseJsonLines("")).toEqual([]);
    expect(parseJsonLines("\n\n")).toEqual([]);
  });
});

describe("parsePsOutput", () => {
  it("parses a real single docker ps JSON line", () => {
    const [entry] = parsePsOutput(PS_LINE_POSTGRES);
    expect(entry.Names).toBe("horizon-grid-postgres-1");
    expect(entry.Image).toBe("postgres:16-alpine");
    expect(entry.State).toBe("running");
    expect(entry.Status).toBe("Up 5 minutes (healthy)");
  });

  it("parses multiple docker ps lines (JSON-lines, not a JSON array)", () => {
    const entries = parsePsOutput(PS_OUTPUT_MULTI_LINE);
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => e.Names)).toEqual([
      "horizon-grid-postgres-1",
      "horizon-grid-redis-1",
      "horizon-grid-frontend-1,horizon-grid-frontend-1-alias",
      "horizon-grid-celery_worker-1",
    ]);
  });
});

describe("parseStatsOutput", () => {
  it("parses a real single docker stats JSON line", () => {
    const [entry] = parseStatsOutput(STATS_LINE_POSTGRES);
    expect(entry.Name).toBe("horizon-grid-postgres-1");
    expect(entry.CPUPerc).toBe("0.42%");
    expect(entry.MemUsage).toBe("9.8MiB / 7.775GiB");
  });

  it("parses multiple docker stats lines", () => {
    const entries = parseStatsOutput(STATS_OUTPUT_MULTI_LINE);
    expect(entries).toHaveLength(3);
  });
});

describe("parsePercent", () => {
  it("parses a percent string into a number", () => {
    expect(parsePercent("0.42%")).toBeCloseTo(0.42);
    expect(parsePercent("12.00%")).toBeCloseTo(12.0);
  });

  it("returns null for missing or unparseable input", () => {
    expect(parsePercent(undefined)).toBeNull();
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent("")).toBeNull();
    expect(parsePercent("not-a-number")).toBeNull();
  });
});

describe("primaryName", () => {
  it("returns the single name unchanged", () => {
    expect(primaryName("horizon-grid-redis-1")).toBe("horizon-grid-redis-1");
  });

  it("takes the first name when a container has multiple comma-joined names", () => {
    expect(primaryName("horizon-grid-frontend-1,horizon-grid-frontend-1-alias")).toBe(
      "horizon-grid-frontend-1"
    );
  });
});

describe("mergeContainerData", () => {
  it("merges ps + stats by container ID into ContainerRow shape", () => {
    const psEntries = parsePsOutput(PS_OUTPUT_MULTI_LINE);
    const statsEntries = parseStatsOutput(STATS_OUTPUT_MULTI_LINE);
    const rows = mergeContainerData(psEntries, statsEntries);

    expect(rows).toHaveLength(4);

    const postgres = rows.find((r) => r.name === "horizon-grid-postgres-1");
    expect(postgres).toBeDefined();
    expect(postgres?.cpuPercent).toBeCloseTo(0.42);
    expect(postgres?.memUsage).toBe("9.8MiB / 7.775GiB");
    expect(postgres?.memPercent).toBeCloseTo(1.23);
    expect(postgres?.state).toBe("running");
  });

  it("matches stats to ps entries even when ps reports a full 64-char ID and stats reports a short 12-char ID", () => {
    const psEntries = parsePsOutput(PS_OUTPUT_MULTI_LINE);
    const statsEntries = parseStatsOutput(STATS_OUTPUT_MULTI_LINE);
    const rows = mergeContainerData(psEntries, statsEntries);

    const redis = rows.find((r) => r.name === "horizon-grid-redis-1");
    expect(redis?.id.length).toBeGreaterThan(12);
    expect(redis?.shortId).toBe("95c56480a9c7");
    expect(redis?.cpuPercent).toBeCloseTo(0.15);
  });

  it("leaves cpu/mem as null when a ps entry has no matching stats entry (e.g. a restarting container)", () => {
    const psEntries = parsePsOutput(PS_LINE_RESTARTING);
    const rows = mergeContainerData(psEntries, []);

    expect(rows).toHaveLength(1);
    expect(rows[0].state).toBe("restarting");
    expect(rows[0].cpuPercent).toBeNull();
    expect(rows[0].memUsage).toBeNull();
    expect(rows[0].memPercent).toBeNull();
  });

  it("returns an empty list when there are no containers", () => {
    expect(mergeContainerData([], [])).toEqual([]);
  });
});
