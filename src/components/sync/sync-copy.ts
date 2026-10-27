import { t as __tr } from "../../lib/i18n";
import type {
  DeviceLimit,
  LocalNotice,
  SyncPauseReason,
  SyncStatus,
  TakeoverHolder,
  VaultOwnership,
  VersionSource,
} from "../../types/sync";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${__tr(n === 1 ? one : many)}`;
}

/** "20 seconds ago", "5 minutes ago", "3 hours ago", else a short date. */
export function formatAgo(ms: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - ms);
  if (diff < MINUTE_MS) return __tr("{v0} ago", { v0: (plural(Math.max(1, Math.round(diff / SECOND_MS)), "second")) });
  if (diff < HOUR_MS) return __tr("{v0} ago", { v0: (plural(Math.floor(diff / MINUTE_MS), "minute")) });
  if (diff < DAY_MS) return __tr("{v0} ago", { v0: (plural(Math.floor(diff / HOUR_MS), "hour")) });
  return formatShortDate(ms);
}

export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Last part of a path, either separator. */
export function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  icloud: "iCloud Drive",
  onedrive: "OneDrive",
  dropbox: "Dropbox",
  gdrive: "Google Drive",
  box: "Box",
  // Every macOS /Volumes path gets this kind (the network heuristics also cover external disks).
  smb: "an external or network drive",
  local: "a local folder",
  syncthing: "Syncthing",
};

/** Kinds that read "on ..." rather than "in ...". */
const DRIVE_KINDS: ReadonlySet<string> = new Set(["smb"]);

function kindOf(location: string | null | undefined): string {
  return location ? (location.split(":")[0] ?? "") : "";
}

/** Provider part of a file-hint location (`<kind>:<folder>`), as plain words. */
export function providerName(location: string | null | undefined): string {
  return __tr(PROVIDER_NAMES[kindOf(location)] ?? "another folder");
}

/** "in iCloud Drive", "on an external or network drive": where a device syncs its file. */
export function providerPlace(location: string | null | undefined): string {
  return __tr("{prep} {provider}", { prep: DRIVE_KINDS.has(kindOf(location)) ? "on" : "in", provider: providerName(location) });
}

export function deviceNameOr(name: string | null | undefined, fallback = __tr("another device")): string {
  return name && name.trim() ? name : fallback;
}

/** Who wrote a conflict version: "Chris's iPhone", "Older Conduit app", a copy's label. */
export function versionSourceLabel(source: VersionSource): string {
  switch (source.kind) {
    case "device":
      return deviceNameOr(source.deviceName, __tr("Unknown device"));
    case "older-app":
      return __tr("Older Conduit app");
    case "genesis":
      return __tr("Original vault");
    case "candidate":
      return source.label;
  }
}

const PAUSE_REASONS: Readonly<Record<SyncPauseReason, string>> = {
  "side-files": "older Conduit open",
  "epoch-newer": "password changed",
  "epoch-legacy": "password changed",
  "epoch-concurrent": "password changed twice",
  displaced: "open on another device",
  "kill-switch": "paused by Conduit",
  "foreign-newer-format": "newer Conduit needed",
  "foreign-other-vault": "file is another vault",
  unreadable: "file can't be read",
  "regression-backoff": "cloud drive restoring old copy",
  "error-backoff": "will retry",
};

export function pauseReasonText(reason: SyncPauseReason | null): string {
  return reason === null ? __tr("paused") : PAUSE_REASONS[reason];
}

/** Short status for the sidebar indicator and the dashboard row. */
export function statusLabel(status: SyncStatus, killSwitch: boolean): string {
  if (killSwitch) return __tr("Paused (paused by Conduit)");
  switch (status.kind) {
    case "up-to-date":
      return __tr("Up to date");
    case "syncing":
      return __tr("Syncing");
    case "waiting":
      return __tr("Waiting for {v0}", { v0: (deviceNameOr(status.waiting?.devices[0]?.deviceName)) });
    case "paused":
      return __tr("Paused ({v0})", { v0: (pauseReasonText(status.pauseReason)) });
    case "file-not-found":
      return __tr("File not found");
    case "offline":
      return __tr("Offline");
    case "pending":
      return __tr("{v0} not yet synced", { v0: (plural(Math.max(1, status.unsyncedOps), "change")) });
    case "error":
      return __tr("Sync problem. Will retry.");
  }
}

export type StatusTone = "ok" | "busy" | "warn" | "error" | "off";

export function statusTone(status: SyncStatus, killSwitch: boolean): StatusTone {
  if (killSwitch) return "warn";
  switch (status.kind) {
    case "up-to-date":
      return "ok";
    case "syncing":
    case "waiting":
      return "busy";
    case "error":
      return "error";
    default:
      return "warn";
  }
}

/** One line under the status, or null. */
export function statusDetail(status: SyncStatus, nowMs: number = Date.now()): string | null {
  if (status.sessionBadge === "offline-device-check") return __tr("Offline: device check paused");
  if (status.lastSyncedMs !== null) return __tr("Last synced {v0}", { v0: (formatAgo(status.lastSyncedMs, nowMs)) });
  return null;
}

/** "one device at a time" or "any number of devices". */
export function deviceLimitText(limit: DeviceLimit | null | number): string {
  const n = typeof limit === "number" ? limit : limit?.limit ?? 1;
  if (n === -1) return __tr("on any number of devices at once");
  if (n === 1) return __tr("on one device at a time");
  return __tr("on up to {v0} devices at once", { v0: (n) });
}

/** "3 open connections and an AI task running" for the take-over dialog and the devices list. */
export function busyText(sessions: number, jobs: number): string | null {
  const parts: string[] = [];
  if (sessions > 0) parts.push(plural(sessions, "open connection"));
  if (jobs > 0) parts.push(jobs === 1 ? "an AI task running" : `${jobs} AI tasks running`);
  return parts.length === 0 ? null : parts.join(__tr(" and "));
}

/** Take-over (6.5): "MacBook has 3 open connections. They keep running; only the vault locks." */
export function holderBusyText(name: string, sessions: number, jobs: number): string | null {
  const busy = busyText(sessions, jobs);
  if (busy === null) return null;
  return __tr("{v0} has {v1}. {v2} running; only the vault locks.", { v0: (name), v1: (busy), v2: (sessions + jobs === 1 ? "It keeps" : "They keep") });
}

/** Displaced (6.6 step 5): "Your 3 open connections and 1 AI task are still running." */
export function stillRunningText(sessions: number, jobs: number): string | null {
  const parts: string[] = [];
  if (sessions > 0) parts.push(plural(sessions, "open connection"));
  if (jobs > 0) parts.push(plural(jobs, "AI task"));
  if (parts.length === 0) return null;
  return __tr("Your {v0} {v1} still running.", { v0: (parts.join(__tr(" and "))), v1: (sessions + jobs === 1 ? "is" : "are") });
}

export function holderActivity(holder: TakeoverHolder, nowMs: number = Date.now()): string {
  const name = deviceNameOr(holder.deviceName);
  return holder.lastActiveMs === null ? name : __tr("{v0} (active {v1})", { v0: (name), v1: (formatAgo(holder.lastActiveMs, nowMs)) });
}

/** Text of a persisted notice; `itemName` names the item its key points at, when known. */
export function noticeText(notice: LocalNotice, itemName: string | null = null): string {
  const item = itemName === null ? "an item" : `'${itemName}'`;
  switch (notice.kind) {
    case "dropped-setting":
      return __tr("An older Conduit app doesn't support some settings of {v0}. They were kept.", { v0: (item) });
    case "value-unrecoverable":
      return __tr("{v0} of {v1} changed by an older Conduit app could not be read. The last known value was kept.", { v0: (plural(Math.max(1, notice.count), "value")), v1: (item) });
    case "undecryptable-secrets":
      return __tr("{v0} used an old master password. Review them to recover.", { v0: (plural(Math.max(1, notice.count), "saved secret")) });
    case "invariant-repair":
      return __tr("Conduit repaired a sync problem and kept two versions of a field of {v0} for review.", { v0: (item) });
    case "mass-change":
      return __tr("A sync from another device deleted or changed {v0}.", { v0: (plural(Math.max(1, notice.count), "item")) });
    case "candidate-dropped":
      return __tr("{v0} waiting for review {v1} removed. {v2} locked with a master password this device no longer has.", { v0: (plural(Math.max(1, notice.count), "copy", "copies")), v1: (notice.count > 1 ? "were" : "was"), v2: (notice.count > 1 ? "They were" : "It was") });
  }
}

/** The server's fallback device cap (app_config account_max_active_devices_fallback), when none was confirmed. */
export const DEFAULT_DEVICE_CAP = 5;

/** Sync settings plan line (plan enforcement 4.7); null when there is no cap. */
export function deviceCapText(n: number | null): string | null {
  if (n === null || n === -1) return null;
  return __tr("Up to {v0} devices at once across your vaults.", { v0: (n) });
}

/**
 * S11: the owner line in Sync settings; null with no personal vault open, and null when signed in
 * without a confirmed answer (offline or a server problem: signing in would not help).
 */
export function ownerLineText(ownership: VaultOwnership | null, signedIn: boolean): string | null {
  if (ownership === null || (ownership.kind === "unknown" && signedIn)) return null;
  switch (ownership.kind) {
    case "owner":
      return __tr("Owner: this account.");
    case "grace":
      return __tr("Owner: another account. You can use it until {v0}.", { v0: (formatShortDate(ownership.untilMs)) });
    case "unowned":
      return __tr("Owner: not set yet.");
    case "unknown":
      return __tr("Owner: sign in to check.");
  }
}

/** S13, and the disabled release button's hint. */
export function releaseAfterText(releaseAfterMs: number): string {
  return __tr("You can release this vault on {v0}.", { v0: (formatShortDate(releaseAfterMs)) });
}

/** Device-cap take-over line: "MacBook: 2 vaults open, active 5 minutes ago". */
export function deviceHolderLine(holder: TakeoverHolder, nowMs: number = Date.now()): string {
  const parts = [holder.vaults == null ? null : `${plural(holder.vaults, "vault")} open`, holder.lastActiveMs === null ? null : `active ${formatAgo(holder.lastActiveMs, nowMs)}`];
  const detail = parts.filter((p): p is string => p !== null).join(", ");
  const name = deviceNameOr(holder.deviceName);
  return detail === "" ? name : `${name}: ${detail}`;
}
