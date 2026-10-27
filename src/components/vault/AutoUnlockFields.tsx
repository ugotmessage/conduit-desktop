import { t as __tr } from "../../lib/i18n";
import { useStartupVaultStore } from "../../stores/startupVaultStore";
import { Button, Callout, Checkbox } from "../ui";

/** The note that replaces the status line when the saved unlock did not work (docs/AUTO_UNLOCK.md 2.1). */
export function AutoUnlockFallbackNote({ onTurnOff }: { onTurnOff: () => void }) {
  const fallback = useStartupVaultStore((s) => s.fallback);
  const storeName = useStartupVaultStore((s) => s.status?.store.storeName ?? "system keychain");
  if (fallback?.kind === "stale") {
    return (
      <Callout tone="warning">
        {__tr("Conduit couldn't open")} {fallback.name} {__tr("automatically. The master password may have changed on another device. Enter it to open the vault.")}</Callout>
    );
  }
  if (fallback?.kind === "unreadable") {
    return (
      <Callout
        tone="warning"
        actions={
          <Button variant="link" size="sm" onClick={onTurnOff}>
            {__tr("Turn Off Automatic Unlock")}</Button>
        }
      >
        {__tr("Conduit couldn't read the saved unlock from the")} {storeName}{__tr(". Enter your master password.")}</Callout>
    );
  }
  return null;
}

interface AutoUnlockCheckboxProps {
  keepMode: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function AutoUnlockCheckbox({ keepMode, checked, onChange }: AutoUnlockCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      description={keepMode ? __tr("Saves the password you enter now.") : __tr("Opens this vault when Conduit starts, without the password.")}
    >
      <span className="font-medium text-ink">{keepMode ? __tr("Keep unlocking automatically at startup") : __tr("Unlock automatically at startup")}</span>
    </Checkbox>
  );
}
