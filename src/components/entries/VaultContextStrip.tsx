import { t as __tr } from "../../lib/i18n";
import { Badge } from "../ui";
import { LockIcon, UsersIcon } from "../../lib/icons";
import { useVaultStore } from "../../stores/vaultStore";
import { useTeamStore } from "../../stores/teamStore";

/** "Saving to: <vault>" under the entry and folder dialog titles. */
export function VaultContextStrip() {
  const vaultType = useVaultStore((s) => s.vaultType);
  const teamVaultId = useVaultStore((s) => s.teamVaultId);
  const currentVaultPath = useVaultStore((s) => s.currentVaultPath);
  const teamVaultName = useTeamStore((s) => s.teamVaults.find((v) => v.id === teamVaultId)?.name);
  const isTeam = vaultType === "team";
  const vaultName = isTeam ? teamVaultName ?? __tr("Team Vault") : currentVaultPath?.split(/[/\\]/).pop() ?? __tr("Personal Vault");

  return (
    <div className="flex shrink-0 items-center gap-2 border-y border-divider px-4 py-2 text-label">
      {isTeam ? <UsersIcon size={16} className="text-info" /> : <LockIcon size={16} className="text-ink-faint" />}
      <span className="text-ink-muted">{__tr("Saving to:")}</span>
      <span className="font-semibold text-ink">{vaultName}</span>
      {isTeam && <Badge>{__tr("Team")}</Badge>}
    </div>
  );
}

export function ViewOnlyNotice() {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-warning-border bg-warning-bg px-4 py-2 text-label text-warning">
      <LockIcon size={16} />
      <span>{__tr("You have view-only access to this folder")}</span>
    </div>
  );
}
