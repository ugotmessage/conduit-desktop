import { t as __tr } from "../../lib/i18n";
import SyncDialogFrame, { DialogButton } from "./SyncDialogFrame";
import { signIn } from "./plan-actions";

/** S6: signed out, and the owner tag names an account. */
export default function SignInRequiredDialog({ onCancel }: { onCancel: () => void }) {
  const signInNow = () => {
    onCancel();
    signIn();
  };
  return (
    <SyncDialogFrame
      icon="lock"
      tone="info"
      title={__tr("Sign in to open this vault")}
      onEscape={onCancel}
      footer={
        <>
          <DialogButton onClick={onCancel}>{__tr("Cancel")}</DialogButton>
          <DialogButton variant="primary" onClick={signInNow} autoFocus>
            {__tr("Sign in")}</DialogButton>
        </>
      }
    >
      <p className="text-ink">{__tr("This vault belongs to a Conduit account. Sign in with that account to open it.")}</p>
    </SyncDialogFrame>
  );
}
