import { t as __tr } from "../../lib/i18n";
import { useEffect, useMemo } from "react";
import { useVaultStore } from "../../stores/vaultStore";
import { useAuthStore } from "../../stores/authStore";
import { DatabaseIcon, HistoryIcon } from "../../lib/icons";
import { Button, Spinner } from "../ui";

interface Props {
  onOpenManager: () => void;
}

export default function BackupHistoryPanel({ onOpenManager }: Props) {
  const {
    cloudBackups,
    cloudBackupRetentionDays,
    loadingBackups,
    listCloudBackups,
    getCloudBackupRetention,
  } = useVaultStore();
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    listCloudBackups();
    getCloudBackupRetention();
  }, [listCloudBackups, getCloudBackupRetention]);

  const tierName = profile?.is_team_member ? "Team" : (profile?.tier?.display_name ?? "Free");
  const limitLabel =
    cloudBackupRetentionDays === -1
      ? __tr("Retain backups indefinitely ({v0})", { v0: (tierName) })
      : cloudBackupRetentionDays !== null && cloudBackupRetentionDays > 0
      ? __tr("Retain backups for {v0} day{v1} ({v2})", { v0: (cloudBackupRetentionDays), v1: (cloudBackupRetentionDays !== 1 ? "s" : ""), v2: (tierName) })
      : null;

  const vaultCount = useMemo(
    () => new Set(cloudBackups.map((b) => b.vaultId)).size,
    [cloudBackups],
  );

  return (
    <div className="pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon size={16} className="shrink-0 text-ink-muted" />
          <span className="text-label font-semibold text-ink-secondary">{__tr("Backup History")}</span>
        </div>
        {limitLabel && (
          <span className="text-badge text-ink-muted">{limitLabel}</span>
        )}
      </div>

      {loadingBackups ? (
        <Spinner size={12} text="Loading backups..." className="py-2 text-label text-ink-muted" />
      ) : cloudBackups.length === 0 ? (
        <p className="text-label text-ink-muted py-1">
          {__tr("No backup snapshots yet. Backups are created automatically each time your vault syncs.")}</p>
      ) : (
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-well">
          <div className="flex items-center gap-2">
            <DatabaseIcon size={16} className="text-ink-muted" />
            <span className="text-label text-ink-secondary">
              {cloudBackups.length} {__tr("backup")}{cloudBackups.length !== 1 ? "s" : ""} {__tr("across")}{" "}
              {vaultCount} {__tr("vault")}{vaultCount !== 1 ? "s" : ""}
            </span>
          </div>
          <Button variant="link" size="sm" onClick={onOpenManager}>
            {__tr("Manage Backups...")}</Button>
        </div>
      )}
    </div>
  );
}
