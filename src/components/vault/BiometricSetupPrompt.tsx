import { t as __tr } from "../../lib/i18n";
import { Button, Dialog } from "../ui";

interface BiometricSetupPromptProps {
  onDismiss: () => void;
  onAccept: () => void;
}

/** Offered after the first password unlock of a vault. Escape dismisses it like Not Now. */
export default function BiometricSetupPrompt({ onDismiss, onAccept }: BiometricSetupPromptProps) {
  return (
    <Dialog
      open
      title={__tr("Enable Quick Unlock")}
      icon="fingerprint"
      width={384}
      hideClose
      onClose={onDismiss}
      footer={
        <>
          <Button onClick={onDismiss}>{__tr("Not Now")}</Button>
          <Button variant="primary" onClick={onAccept}>
            {__tr("Enable")}</Button>
        </>
      }
    >
      <p className="text-ink-muted">
        {__tr("Unlock this vault faster next time with Touch ID, Apple Watch, or your system password.")}</p>
    </Dialog>
  );
}
