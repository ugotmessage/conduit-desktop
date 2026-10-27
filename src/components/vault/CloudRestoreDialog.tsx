import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { useVaultStore } from "../../stores/vaultStore";
import { Button, Callout, Dialog, FormField, IconButton, IconSlot, TextInput, type IconSource } from "../ui";

const TRUST_BADGES: ReadonlyArray<{ icon: IconSource; text: string }> = [
  { icon: "shield", text: "AES-256-GCM encrypted" },
  { icon: "lock", text: "Zero-knowledge — we cannot access your data" },
  { icon: "server", text: "Backed by enterprise-grade AWS infrastructure" },
  { icon: "key", text: "Your master password never leaves this device" },
];

interface CloudRestoreDialogProps {
  onRestore: () => void;
  onCreateNew: () => void;
}

export default function CloudRestoreDialog({
  onRestore,
  onCreateNew,
}: CloudRestoreDialogProps) {
  const { restoreFromCloud, isLoading, error, clearError } = useVaultStore();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await restoreFromCloud(password);
      onRestore();
    } catch {
      // Error is set in the store
    }
  };

  return (
    <Dialog
      open
      title={__tr("Welcome Back")}
      icon="cloudDownload"
      width={384}
      hideClose
      closeOnEscape={false}
      onSubmit={(e) => void handleRestore(e)}
      footer={
        <>
          <Button onClick={onCreateNew}>{__tr("Create New Vault")}</Button>
          <Button type="submit" variant="primary" disabled={!password} loading={isLoading} loadingLabel="Restoring...">
            {__tr("Restore from Cloud")}</Button>
        </>
      }
    >
      <p className="text-ink-muted">{__tr("We found your encrypted vault backup")}</p>

      <ul className="space-y-2">
        {TRUST_BADGES.map((badge) => (
          <li key={badge.text} className="flex items-center gap-2 text-label text-ink-secondary">
            <IconSlot icon={badge.icon} className="text-success flex-shrink-0" />
            <span>{badge.text}</span>
          </li>
        ))}
      </ul>

      <FormField label={__tr("Master Password")}>
        <TextInput
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={__tr("Enter your master password")}
          autoFocus
          trailing={
            <IconButton
              size="sm"
              icon={showPassword ? "eyeOff" : "eye"}
              label={showPassword ? __tr("Hide password") : __tr("Show password")}
              onClick={() => setShowPassword(!showPassword)}
            />
          }
        />
      </FormField>

      {error && (
        <Callout tone="danger" size="sm">
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
