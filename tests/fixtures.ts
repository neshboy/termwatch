/**
 * Realistic fixtures matching the REAL documented JSON-lines shape of
 * `docker ps --format '{{json .}}'` and `docker stats --no-stream --format '{{json .}}'`.
 * Field names/casing/content mirror actual Docker CLI output (including the
 * comma-joined multi-network/multi-name fields and human-readable units),
 * captured from a real local Docker Desktop daemon during development.
 */

export const PS_LINE_POSTGRES =
  '{"Command":"\\"docker-entrypoint.s\\u2026\\"","CreatedAt":"2026-09-24 17:33:31 +0800 +08","ID":"99b3a6bd956b","Image":"postgres:16-alpine","Labels":"com.docker.compose.project=horizon-grid,com.docker.compose.service=postgres","LocalVolumes":"1","Mounts":"horizon-grid_p…","Names":"horizon-grid-postgres-1","Networks":"horizon-grid_default","Ports":"127.0.0.1:5433->5432/tcp","RunningFor":"5 minutes ago","Size":"20.5kB (virtual 303MB)","State":"running","Status":"Up 5 minutes (healthy)"}';

export const PS_LINE_REDIS =
  '{"Command":"\\"docker-entrypoint.s\\u2026\\"","CreatedAt":"2026-09-24 17:33:31 +0800 +08","ID":"95c56480a9c7dd0e1a2b3c4d5e6f7081920314151617181920a1b2c3d4e5f60","Image":"redis:7-alpine","Labels":"com.docker.compose.project=horizon-grid,com.docker.compose.service=redis","LocalVolumes":"1","Mounts":"horizon-grid_r…","Names":"horizon-grid-redis-1","Networks":"horizon-grid_default","Ports":"127.0.0.1:6379->6379/tcp","RunningFor":"5 minutes ago","Size":"4.1kB (virtual 41.1MB)","State":"running","Status":"Up 5 minutes (healthy)"}';

export const PS_LINE_FRONTEND_MULTI_NAME =
  '{"Command":"\\"npm start\\"","CreatedAt":"2026-09-21 13:51:29 +0800 +08","ID":"91ba6b639bc4aa11bb22cc33dd44ee55ff6600771122334455667788990011a","Image":"horizon-grid-frontend","Labels":"com.docker.compose.project=horizon-grid,com.docker.compose.service=frontend","LocalVolumes":"2","Mounts":"/run/desktop/m…","Names":"horizon-grid-frontend-1,horizon-grid-frontend-1-alias","Networks":"horizon-grid_default","Ports":"0.0.0.0:3100->3000/tcp, [::]:3100->3000/tcp","RunningFor":"3 days ago","Size":"41kB (virtual 1.29GB)","State":"running","Status":"Up 3 days"}';

export const PS_LINE_RESTARTING =
  '{"Command":"\\"celery worker\\"","CreatedAt":"2026-09-21 13:51:28 +0800 +08","ID":"6af3cf9fc8e011223344556677889900aabbccddeeff00112233445566778899","Image":"horizon-grid-celery_worker","Labels":"com.docker.compose.project=horizon-grid,com.docker.compose.service=celery_worker","LocalVolumes":"0","Mounts":"","Names":"horizon-grid-celery_worker-1","Networks":"horizon-grid_default","Ports":"","RunningFor":"3 days ago","Size":"1.37MB (virtual 1.74GB)","State":"restarting","Status":"Restarting (1) 2 seconds ago"}';

export const PS_OUTPUT_MULTI_LINE = [
  PS_LINE_POSTGRES,
  PS_LINE_REDIS,
  PS_LINE_FRONTEND_MULTI_NAME,
  PS_LINE_RESTARTING,
].join("\n");

export const STATS_LINE_POSTGRES =
  '{"BlockIO":"172kB / 41MB","CPUPerc":"0.42%","Container":"99b3a6bd956b","ID":"99b3a6bd956b","MemPerc":"1.23%","MemUsage":"9.8MiB / 7.775GiB","Name":"horizon-grid-postgres-1","NetIO":"5.2kB / 3.1kB","PIDs":"9"}';

export const STATS_LINE_REDIS =
  '{"BlockIO":"0B / 0B","CPUPerc":"0.15%","Container":"95c56480a9c7","ID":"95c56480a9c7","MemPerc":"0.09%","MemUsage":"6.836MiB / 7.775GiB","Name":"horizon-grid-redis-1","NetIO":"1.1kB / 0B","PIDs":"5"}';

export const STATS_LINE_FRONTEND =
  '{"BlockIO":"12.3MB / 0B","CPUPerc":"2.87%","Container":"91ba6b639bc4","ID":"91ba6b639bc4","MemPerc":"4.51%","MemUsage":"350.4MiB / 7.775GiB","Name":"horizon-grid-frontend-1","NetIO":"890kB / 120kB","PIDs":"22"}';

// Note: a restarting container is intentionally omitted from `docker stats`
// output (docker stats only reports live/running containers), to exercise
// the merge logic's handling of a ps entry with no matching stats entry.
export const STATS_OUTPUT_MULTI_LINE = [
  STATS_LINE_POSTGRES,
  STATS_LINE_REDIS,
  STATS_LINE_FRONTEND,
].join("\n");
