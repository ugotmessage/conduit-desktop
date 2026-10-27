import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { invoke } from "../../lib/electron";
import { useVaultStore } from "../../stores/vaultStore";
import { useTeamStore } from "../../stores/teamStore";
import { toast } from "../common/Toast";
import { Button, Callout, Dialog, FormField, TextInput } from "../ui";
import { errorText } from "../../lib/errorText";

interface RenameVaultDialogProps {
  onClose: () => void;
}

export default function RenameVaultDialog({ onClose }: RenameVaultDialogProps) {
  const { currentVaultPath, vaultType, teamVaultId } = useVaultStore();
  const { teamVaults } = useTeamStore();

  const isTeamVault = vaultType === "team";

  const currentName = isTeamVault
    ? teamVaults.find((v) => v.id === teamVaultId)?.name ?? ""
    : currentVaultPath
        ?.split(/[/\\]/)
        .pop()
        ?.replace(/\.conduit$/i, "") ?? "";

  const [newName, setNewName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = newName.trim().length > 0 && newName.trim() !== currentName;

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      if (isTeamVault && teamVaultId) {
        await invoke("team_vault_rename", {
          teamVaultId,
          newName: newName.trim(),
        });
        await useTeamStore.getState().loadTeamVaults();
      } else {
        const newPath = await invoke<string>("vault_rename", {
          newName: newName.trim(),
        });
        const settings = await invoke<{ recent_vaults?: string[] }>(
          "settings_get",
        );
        useVaultStore.setState({
          currentVaultPath: newPath,
          recentVaults: settings.recent_vaults ?? [],
        });
      }

      toast.success(__tr("Vault renamed to \"{v0}\"", { v0: (newName.trim()) }));
      onClose();
    } catch (err) {
      setError(errorText(err, __tr("Failed to rename vault")));
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      title={__tr("Rename Vault")}
      description={__tr("Change the display name of this vault")}
      icon="pencil"
      width={400}
      hideClose
      closeOnEscape={false}
      onClose={onClose}
      onSubmit={(e) => void handleRename(e)}
      footer={
        <>
          <Button onClick={onClose}>{__tr("Cancel")}</Button>
          <Button type="submit" variant="primary" disabled={!isValid} loading={loading}>
            {__tr("Rename")}</Button>
        </>
      }
    >
      <FormField
        label={__tr("Vault Name")}
        description={isTeamVault ? undefined : <>{__tr("File will be renamed to “")}{newName.trim() || "..."}{__tr(".conduit”")}</>}
      >
        <TextInput
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          placeholder={__tr("Enter new vault name")}
          autoFocus
        />
      </FormField>

      {error && <Callout tone="danger">{error}</Callout>}
    </Dialog>
  );
}
