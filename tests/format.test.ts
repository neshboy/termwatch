import { describe, expect, it } from "vitest";
import { formatCpu, formatMem, formatSnapshotTable } from "../src/format.js";
import { mergeContainerData, parsePsOutput, parseStatsOutput } from "../src/parse.js";
import type { ContainerRow } from "../src/model.js";
import { PS_OUTPUT_MULTI_LINE, STATS_OUTPUT_MULTI_LINE } from "./fixtures.js";

describe("formatCpu", () => {
  it("formats a known CPU percent to two decimal places", () => {
    expect(formatCpu(0.4)).toBe("0.40%");
    expect(formatCpu(12)).toBe("12.00%");
  });

  it("formats an unknown CPU percent as n/a", () => {
    expect(formatCpu(null)).toBe("n/a");
  });
});

describe("formatMem", () => {
  it("formats usage with a percentage when both are known", () => {
    expect(formatMem({ memUsage: "9.8MiB / 7.775GiB", memPercent: 1.23 })).toBe(
      "9.8MiB / 7.775GiB (1.2%)"
    );
  });

  it("formats usage alone when percentage is unknown", () => {
    expect(formatMem({ memUsage: "9.8MiB / 7.775GiB", memPercent: null })).toBe(
      "9.8MiB / 7.775GiB"
    );
  });

  it("formats n/a when usage is unknown", () => {
    expect(formatMem({ memUsage: null, memPercent: null })).toBe("n/a");
  });
});

describe("formatSnapshotTable", () => {
  const rows = mergeContainerData(
    parsePsOutput(PS_OUTPUT_MULTI_LINE),
    parseStatsOutput(STATS_OUTPUT_MULTI_LINE)
  );

  it("renders a header row and one line per container", () => {
    const table = formatSnapshotTable(rows);
    const lines = table.split("\n");

    expect(lines[0]).toMatch(/NAME/);
    expect(lines[0]).toMatch(/STATE/);
    expect(lines[0]).toMatch(/CPU%/);
    expect(lines[0]).toMatch(/MEM/);
    expect(lines[1]).toMatch(/^-+/);
    // header + separator + one row per container
    expect(lines).toHaveLength(2 + rows.length);
  });

  it("includes real container names, states and formatted cpu/mem for each row", () => {
    const table = formatSnapshotTable(rows);
    expect(table).toContain("horizon-grid-postgres-1");
    expect(table).toContain("running");
    expect(table).toContain("0.42%");
    expect(table).toContain("celery_worker-1");
    // the restarting container has no matching stats entry
    expect(table).toContain("restarting");
  });

  it("prints a friendly message when there are no containers", () => {
    const table = formatSnapshotTable([]);
    expect(table).toContain("(no running containers)");
  });

  it("truncates names longer than the column width instead of breaking alignment", () => {
    const longName: ContainerRow = {
      id: "abc123",
      shortId: "abc123",
      name: "a-very-long-container-name-that-exceeds-the-column-width",
      image: "example/image:latest",
      state: "running",
      status: "Up 1 minute",
      uptime: "1 minute ago",
      cpuPercent: 0,
      memUsage: "1MiB / 1GiB",
      memPercent: 0.1,
      ports: "",
    };
    const table = formatSnapshotTable([longName]);
    const dataLine = table.split("\n")[2];
    // NAME column width is 28; the row line up to the CPU column start should be 28 chars.
    expect(dataLine.slice(0, 28)).toHaveLength(28);
    expect(dataLine).toContain("…");
  });

  it("keeps every row the same width regardless of content length (alignment stays intact)", () => {
    const table = formatSnapshotTable(rows);
    const lines = table.split("\n").slice(2);
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });
});
