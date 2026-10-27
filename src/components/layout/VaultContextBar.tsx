import { t as __tr } from "../../lib/i18n";
import { useVaultStore } from "../../stores/vaultStore";
import { useTeamStore, type TeamVaultSummary } from "../../stores/teamStore";
import { CircleFilledIcon } from "../../lib/icons";
import { IconButton } from "../ui";

function syncTooltip(status: string): string {
  switch (status) {
    case "synced":
      return __tr("Synced");
    case "syncing":
      return __tr("Syncing\u2026");
    case "offline":
      return __tr("Offline");
    case "error":
      return __tr("Sync error");
    default:
      return __tr("Idle");
  }
}

function syncDotClass(status: string): string {
  switch (status) {
    case "synced":
      return "text-(--c-state-connected)";
    case "syncing":
      return "text-(--c-state-connected) animate-pulse";
    case "offline":
      return "text-(--c-state-connecting)";
    case "error":
      return "text-(--c-state-error)";
    default:
      return "text-ink-faint";
  }
}

export default function VaultContextBar() {
  const { vaultType, teamVaultId, teamSyncState } = useVaultStore();
  const { teamVaults } = useTeamStore();

  if (vaultType !== "team" || !teamVaultId) return null;

  const activeVault: TeamVaultSummary | undefined = teamVaults.find(
    (v) => v.id === teamVaultId
  );
  if (!activeVault) return null;

  const syncStatus = teamSyncState?.status ?? "idle";

  return (
    <div className="flex h-section shrink-0 items-center justify-between px-2 border-b border-team-border border-l-2 border-l-team-border-strong bg-team">
      <div className="flex items-center gap-1.5">
        <span className="flex shrink-0" title={syncTooltip(syncStatus)}>
          <CircleFilledIcon size={12} className={syncDotClass(syncStatus)} />
        </span>
        <span className="text-meta text-ink-muted select-none">{__tr("Team")}</span>
      </div>
      <IconButton
        size="sm"
        icon="settings"
        label={__tr("Vault settings")}
        onClick={() =>
          document.dispatchEvent(
            new CustomEvent("conduit:vault-settings", {
              detail: { tab: "members" },
            })
          )
        }
      />
    </div>
  );
}
