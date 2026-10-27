import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import type { OpenErrorPayload } from "../../types/sync";
import SyncDialogFrame, { DialogButton } from "./SyncDialogFrame";
import { Button } from "../ui";
import { makeOwnCopy, openTeamTrial, switchAccount } from "./plan-actions";

type NotOwner = Extract<OpenErrorPayload, { code: "VAULT_NOT_OWNER" }>;

interface NotOwnerDialogProps {
  payload: NotOwner;
  onCancel: () => void;
}

export const NOT_OWNER_TITLE = __tr("This vault belongs to another account");

/** S4 body; S8b when this account released the vault earlier. */
export function notOwnerBody(payload: NotOwner): string {
  return payload.released
    ? "You released this vault and another account now owns it. Unlock it again to make your own copy."
    : "This vault, or the file it was copied from, belongs to another Conduit account. Make your own copy to keep using this data, or ask the owner to share it with you in a Team vault.";
}

/** S5: refused offline by the owner tag. */
function OfflineNotOwner({ onCancel }: { onCancel: () => void }) {
  return (
    <SyncDialogFrame
      icon="lock"
      tone="warn"
      title={NOT_OWNER_TITLE}
      onEscape={onCancel}
      footer={
        <DialogButton variant="primary" onClick={onCancel} autoFocus>
          {__tr("OK")}</DialogButton>
      }
    >
      <p className="text-ink">{__tr("Connect to the internet so Conduit can check who owns this vault, then try again.")}</p>
    </SyncDialogFrame>
  );
}

/** S4: the server says another account owns this vault and its grace ended. */
export default function NotOwnerDialog({ payload, onCancel }: NotOwnerDialogProps) {
  const email = useAuthStore((s) => s.user?.email ?? null);
  const [busy, setBusy] = useState(false);
  if (payload.offline) return <OfflineNotOwner onCancel={onCancel} />;
  const ticket = payload.copyTicket;

  const copy = async () => {
    if (ticket === null) return;
    setBusy(true);
    try {
      if (await makeOwnCopy(ticket, payload.copyDir)) onCancel();
    } finally {
      setBusy(false);
    }
  };
  const openOther = () => {
    onCancel();
    document.dispatchEvent(new CustomEvent("conduit:open-vault"));
  };
  const switchTo = () => {
    onCancel();
    void switchAccount();
  };

  return (
    <SyncDialogFrame
      icon="lock"
      tone="warn"
      title={NOT_OWNER_TITLE}
      width={480}
      onEscape={onCancel}
      footer={
        <>
          <DialogButton onClick={switchTo} disabled={busy}>{__tr("Switch account")}</DialogButton>
          <DialogButton onClick={openTeamTrial} disabled={busy}>{__tr("Try Team free")}</DialogButton>
          <DialogButton onClick={onCancel} disabled={busy}>{__tr("Cancel")}</DialogButton>
          {ticket !== null && (
            <DialogButton variant="primary" onClick={() => void copy()} loading={busy} loadingLabel="Making your copy..." autoFocus>
              {__tr("Make my own copy")}</DialogButton>
          )}
        </>
      }
    >
      <p className="text-ink">{notOwnerBody(payload)}</p>
      {email && (
        <p>{__tr("You're signed in as")} {email}{__tr(". If this is your vault, sign in with the account you use on your other devices.")}</p>
      )}
      <p>
        {__tr("Made a copy on another device already?")}{" "}
        <Button variant="link" size="sm" onClick={openOther} disabled={busy}>
          {__tr("Open a vault...")}</Button>
      </p>
    </SyncDialogFrame>
  );
}
