import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { invoke } from "../../lib/electron";
import { errorText } from "../../lib/errorText";
import { useSyncStore } from "../../stores/syncStore";
import { toast } from "../common/Toast";
import { Button, Callout, Checkbox, Dialog, FormField, IconButton, TextInput } from "../ui";

interface ChangePasswordDialogProps {
  onClose: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordDialog({ onClose }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eraseDeleted, setEraseDeleted] = useState(false);
  // Only the sync engine's password change can erase graves (spec 4.7, 4.8 step 6).
  const engineSync = useSyncStore((s) => s.state?.vault?.engine === true);

  const passwordTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      await invoke("vault_change_password", {
        currentPassword,
        newPassword,
        eraseRecentlyDeleted: engineSync && eraseDeleted,
      });
      toast.success(__tr("Vault password changed successfully"));
      onClose();
    } catch (err) {
      // invoke() rejects with an Error, so its message is the reason (a wrong current password, say).
      setError(errorText(err, __tr("Failed to change password")));
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      title={__tr("Change Password")}
      description={__tr("Update the master password for this vault")}
      icon="lock"
      width={420}
      hideClose
      closeOnEscape={false}
      onClose={onClose}
      onSubmit={(e) => void handleSubmit(e)}
      footer={
        <>
          <Button onClick={onClose}>{__tr("Cancel")}</Button>
          <Button type="submit" variant="primary" disabled={!isValid} loading={loading}>
            {__tr("Change Password")}</Button>
        </>
      }
    >
      <FormField label={__tr("Current Password")}>
        <PasswordField
          value={currentPassword}
          onChange={(value) => {
            setCurrentPassword(value);
            setError(null);
          }}
          placeholder={__tr("Enter current password")}
          shown={showCurrent}
          onToggle={() => setShowCurrent(!showCurrent)}
          autoFocus
        />
      </FormField>

      <FormField
        label={__tr("New Password")}
        description={
          passwordTooShort ? <span className="text-warning">{__tr("Password must be at least")} {MIN_PASSWORD_LENGTH} {__tr("characters")}</span> : undefined
        }
      >
        <PasswordField
          value={newPassword}
          onChange={(value) => {
            setNewPassword(value);
            setError(null);
          }}
          placeholder={__tr("Enter new password")}
          shown={showNew}
          onToggle={() => setShowNew(!showNew)}
        />
      </FormField>

      <FormField
        label={__tr("Confirm New Password")}
        description={passwordsMismatch ? <span className="text-warning">{__tr("Passwords do not match")}</span> : undefined}
      >
        <PasswordField
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setError(null);
          }}
          placeholder={__tr("Confirm new password")}
          shown={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
        />
      </FormField>

      {engineSync && (
        <Checkbox checked={eraseDeleted} onChange={setEraseDeleted} className="text-label text-ink-muted">
          {__tr("Also permanently delete items in Recently deleted, on every device. Recommended if your old password may have leaked.")}</Checkbox>
      )}

      {error && <Callout tone="danger">{error}</Callout>}
    </Dialog>
  );
}

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  shown: boolean;
  onToggle: () => void;
  autoFocus?: boolean;
}

function PasswordField({ value, onChange, placeholder, shown, onToggle, autoFocus }: PasswordFieldProps) {
  return (
    <TextInput
      type={shown ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      trailing={
        <IconButton
          size="sm"
          icon={shown ? "eyeOff" : "eye"}
          label={shown ? __tr("Hide password") : __tr("Show password")}
          onClick={onToggle}
          tabIndex={-1}
        />
      }
    />
  );
}
