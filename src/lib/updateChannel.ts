import { t as __tr } from "./i18n";
import type { ReleaseEntry } from "../types/whats-new";
import { isPrereleaseVersion } from "../../electron/services/update-channel";

export { isPrereleaseVersion };

/** What `updater_get_channel` returns. */
export interface UpdateChannelInfo {
  betaUpdates: boolean;
  version: string;
  isPrerelease: boolean;
}

export interface UpdateCheckResult {
  version: string;
  downloaded: boolean;
}

export function updateCheckToast(result: UpdateCheckResult | null, currentVersion: string): { title: string; message: string } {
  if (!result) return { title: __tr("Conduit is up to date"), message: __tr("You have version {v0}.", { v0: (currentVersion) }) };
  if (result.downloaded) return { title: __tr("Conduit {v0} is ready", { v0: (result.version) }), message: __tr("Restart Conduit to install it.") };
  return {
    title: __tr("Conduit {v0} is available", { v0: (result.version) }),
    message: __tr("It's downloading now. You'll be asked to restart when it's ready."),
  };
}

export type WhatsNewAutoOpen = "open" | "skip" | "mark-seen";

/** `releases` is the loaded manifest, or null when it was not loaded or could not load. */
export function whatsNewAutoOpen(version: string, lastSeen: string | null, releases: readonly ReleaseEntry[] | null): WhatsNewAutoOpen {
  if (lastSeen === version) return "skip";
  if (!isPrereleaseVersion(version)) return "open";
  if (releases === null) return "skip";
  return releases.some((r) => r.version === version) ? "open" : "mark-seen";
}
