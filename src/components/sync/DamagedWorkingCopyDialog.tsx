import { t as __tr } from "../../lib/i18n";
import SyncDialogFrame, { DialogButton } from "./SyncDialogFrame";

interface DamagedWorkingCopyDialogProps {
  fileName: string;
  recoverable: boolean;
  busy: boolean;
  onRecover: () => void;
  onCancel: () => void;
}

/** VAULT_WORKING_COPY_DAMAGED: set the local copy aside and start again from the shared file. */
export default function DamagedWorkingCopyDialog({ fileName, recoverable, busy, onRecover, onCancel }: DamagedWorkingCopyDialogProps) {
  return (
    <SyncDialogFrame
      icon="alertTriangle"
      tone="danger"
      title={__tr("This computer's copy is damaged")}
      onEscape={onCancel}
      footer={
        recoverable ? (
          <>
            <DialogButton onClick={onCancel} disabled={busy}>{__tr("Cancel")}</DialogButton>
            <DialogButton variant="primary" onClick={onRecover} loading={busy} loadingLabel="Rebuilding..." autoFocus>
              {__tr("Rebuild from shared file")}</DialogButton>
          </>
        ) : (
          <DialogButton variant="primary" onClick={onCancel} autoFocus>{__tr("OK")}</DialogButton>
        )
      }
    >
      <p className="text-ink">{__tr("Conduit keeps a working copy of '")}{fileName}{__tr("' on this computer, and it can't be read.")}</p>
      {recoverable ? (
        <p>
          {__tr("Conduit can set it aside and start again from the shared file. The damaged copy is kept, not deleted. Changes that had not synced yet stay in it.")}</p>
      ) : (
        <p>{__tr("The shared file can't be read right now either. Try again when it is available.")}</p>
      )}
    </SyncDialogFrame>
  );
}
