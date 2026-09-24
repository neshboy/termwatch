# Termwatch

A terminal-native, k9s-style live dashboard for Docker container health. SSH into any box running Docker, run one command, and get a keyboard-driven, auto-refreshing view of every running container's CPU, memory, uptime and status — with drill-down into real live-tailed logs and the ability to restart or stop a container, all without leaving the terminal.

No browser. No agent to install on the target. Just the Docker CLI, a terminal, and Termwatch.

## Termwatch vs. meshmap

Termwatch is part of the same portfolio as [`meshmap`](../meshmap), a sibling project — the two solve different problems and are not interchangeable:

| | **meshmap** | **Termwatch** |
|---|---|---|
| What it shows | A **static topology diagram** rendered from a `docker-compose.yml` file | A **live, interactive dashboard** of your actually-running containers |
| Data source | The compose file on disk (config, not runtime state) | The real Docker Engine, polled live (`docker ps` / `docker stats`) |
| Output | A diagram you generate once and look at | A dashboard that keeps updating while you watch it |
| Interaction | None — it's a rendered artifact | Full keyboard navigation, log tailing, restart/stop |
| Question it answers | "How are these services wired together, on paper?" | "Is this container healthy *right now*, and what is it logging?" |

In short: meshmap tells you what your compose file *says* should exist; Termwatch tells you what Docker *is actually doing* at this second.

## What it does

- Polls the real local Docker daemon every 2 seconds (`docker ps` + `docker stats --no-stream`) and renders a live, auto-refreshing list of running containers with real CPU%, memory, status and uptime.
- Keyboard-driven navigation (arrow keys or `j`/`k`, k9s-style) to move through the list.
- Press `Enter` to drill into a container and live-tail its real logs (`docker logs -f`).
- Press `r` to restart or `s` to stop the selected container — each asks for an explicit confirmation first, because these are real, mutating actions against a real running container.
- `termwatch snapshot` prints the same real data as a one-shot plain-text table — no TUI, no keyboard, safe to pipe over SSH or drop into a script/cron job/health check.

## Install / quick start

```bash
git clone <this-repo>
cd termwatch
npm install
npm run build

# Launch the interactive dashboard against your local Docker daemon
node dist/cli.js

# Or, for scripting / SSH one-liners / CI health checks — no TUI:
node dist/cli.js snapshot
```

Once built, you can also link it as a global command:

```bash
npm link
termwatch            # interactive dashboard
termwatch snapshot   # one-shot table
```

Requires Node.js 18+, the `docker` CLI on your `PATH`, and a reachable Docker daemon (local socket on Linux/macOS, named pipe on Windows via Docker Desktop).

## Example snapshot output

Real output captured from `termwatch snapshot` against a live local Docker Desktop daemon running an 8-container compose stack:

```
NAME                         STATE        CPU%     MEM                        UPTIME           IMAGE
---------------------------- ------------ -------- -------------------------- ---------------- ------------------------------
horizon-grid-postgres-1      running      0.11%    28.96MiB / 1GiB (2.8%)     15 minutes ago   postgres:16-alpine
horizon-grid-redis-1         running      8.97%    10.08MiB / 256MiB (3.9%)   15 minutes ago   redis:7-alpine
horizon-grid-frontend-1      running      0.00%    629.1MiB / 1GiB (61.4%)    3 days ago       horizon-grid-frontend
horizon-grid-backend-1       running      8.34%    333.4MiB / 4GiB (8.1%)     3 days ago       horizon-grid-backend
horizon-grid-celery_worker-1 running      0.08%    275.4MiB / 1GiB (26.9%)    3 days ago       horizon-grid-celery_worker
horizon-grid-celery_beat-1   running      0.00%    71.06MiB / 512MiB (13.9%) 3 days ago       horizon-grid-celery_beat
horizon-grid-neo4j-1         running      0.84%    532.5MiB / 1GiB (52.0%)   3 days ago       neo4j:5-community
horizon-grid-opensearch-1    running      0.81%    1019MiB / 1GiB (99.5%)    3 days ago       opensearchproject/opensearch:…
```

(Names/images above belong to a real local compose stack used only as a read-only test target during development; nothing in that stack was modified.)

## Keyboard controls

| Key | Action |
|---|---|
| `↑` / `k` | Move selection up |
| `↓` / `j` | Move selection down |
| `Enter` | Drill into the selected container's real, live-tailed logs |
| `r` | Restart the selected container (asks for confirmation first) |
| `s` | Stop the selected container (asks for confirmation first) |
| `q` / `Esc` | Back out of the log view, or quit from the list |
| `Ctrl-C` | Quit immediately |

## How it works

- Container listing and stats come from shelling out to the real Docker CLI (`docker ps --format '{{json .}}'` and `docker stats --no-stream --format '{{json .}}'`), always invoked as argv arrays (`execFile`/`spawn`), never as an interpolated shell string.
- `docker ps` and `docker stats` output is JSON-lines (one JSON object per line, not a JSON array); Termwatch parses each line and merges the two sources by container ID into an internal `ContainerRow` model.
- The interactive dashboard is built on [`blessed`](https://github.com/chjj/blessed), polling `docker ps`/`docker stats` on a 2-second interval and re-rendering the list in place.
- Log tailing spawns a real `docker logs --tail 100 -f <container>` child process and streams its stdout/stderr into a scrollable panel.
- `termwatch snapshot` reuses the exact same data-gathering and formatting code path as the TUI's list, just rendered once as plain text instead of live in a screen — this is also what makes the core logic unit-testable without needing a TTY.

## Testing

The interactive TUI itself (keyboard-driven `blessed` rendering) is not unit-tested — that's expected for a terminal UI and is exercised manually. What *is* unit-tested with [Vitest](https://vitest.dev) is all of the real data-gathering and formatting logic underneath it:

- Parsing real `docker ps`/`docker stats` JSON-lines output into the internal model (including multi-name containers, full vs. short container IDs, and containers with no matching stats entry).
- Merging `ps` + `stats` data by container ID.
- The `termwatch snapshot` table formatter (column alignment, truncation, missing-data fallbacks).

```bash
npm test
```

## Limitations

- **Local Docker only.** v1 talks to a single local Docker daemon via the `docker` CLI. There is no Kubernetes, Docker Swarm, or remote-daemon (`DOCKER_HOST` over TCP/SSH) support yet.
- **`r` (restart) and `s` (stop) mutate real, running containers.** This is a deliberate, real capability, not a demo — Termwatch shells out to the real `docker restart`/`docker stop` commands. Both actions require an explicit confirmation prompt before running, but there is no dry-run mode and no undo. Do not point Termwatch at a production host and mash keys; treat `r`/`s` with the same care you'd give running `docker restart`/`docker stop` directly, because that is exactly what they do.
- No authentication/authorization layer — Termwatch has whatever access your local `docker` CLI has. Anyone who can run Termwatch on a box can restart or stop any container visible to `docker ps` on that box.
- No historical metrics or alerting — this is a live snapshot dashboard, not a monitoring/alerting system with retention.

## License

MIT — see [LICENSE](./LICENSE).
